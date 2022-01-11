// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "./Accountant.sol";
import "./CreditLine.sol";
import "./GoldfinchFactory.sol";
import "../../interfaces/IV1CreditLine.sol";
import "../../interfaces/IMigratedTranchedPool.sol";

/**
 * @title Goldfinch's CreditDesk contract
 * @notice Main entry point for borrowers and underwriters.
 *  Handles key logic for creating CreditLine's, borrowing money, repayment, etc.
 * @author Goldfinch
 */

contract CreditDesk is BaseUpgradeablePausable, ICreditDesk {
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  struct Underwriter {
    uint256 governanceLimit;
    address[] creditLines;
  }

  struct Borrower {
    address[] creditLines;
  }

  event PaymentApplied(
    address indexed payer,
    address indexed creditLine,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount
  );
  event PaymentCollected(address indexed payer, address indexed creditLine, uint256 paymentAmount);
  event DrawdownMade(address indexed borrower, address indexed creditLine, uint256 drawdownAmount);
  event CreditLineCreated(address indexed borrower, address indexed creditLine);
  event GovernanceUpdatedUnderwriterLimit(address indexed underwriter, uint256 newLimit);

  mapping(address => Underwriter) public underwriters;
  mapping(address => Borrower) private borrowers;
  mapping(address => address) private creditLines;

  /**
   * @notice Run only once, on initialization
   * @param owner The address of who should have the "OWNER_ROLE" of this contract
   * @param _config The address of the GoldfinchConfig contract
   */
  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  /**
   * @notice Sets a particular underwriter's limit of how much credit the DAO will allow them to "create"
   * @param underwriterAddress The address of the underwriter for whom the limit shall change
   * @param limit What the new limit will be set to
   * Requirements:
   *
   * - the caller must have the `OWNER_ROLE`.
   */
  function setUnderwriterGovernanceLimit(address underwriterAddress, uint256 limit)
    external
    override
    onlyAdmin
    whenNotPaused
  {
    require(withinMaxUnderwriterLimit(limit), "This limit is greater than the max allowed by the protocol");
    underwriters[underwriterAddress].governanceLimit = limit;
    emit GovernanceUpdatedUnderwriterLimit(underwriterAddress, limit);
  }

  /**
   * @notice Allows a borrower to drawdown on their creditline.
   *  `amount` USDC is sent to the borrower, and the credit line accounting is updated.
   * @param creditLineAddress The creditline from which they would like to drawdown
   * @param amount The amount, in USDC atomic units, that a borrower wishes to drawdown
   *
   * Requirements:
   *
   * - the caller must be the borrower on the creditLine
   */
  function drawdown(address creditLineAddress, uint256 amount)
    external
    override
    whenNotPaused
    onlyValidCreditLine(creditLineAddress)
  {
    CreditLine cl = CreditLine(creditLineAddress);
    Borrower storage borrower = borrowers[msg.sender];
    require(borrower.creditLines.length > 0, "No credit lines exist for this borrower");
    require(amount > 0, "Must drawdown more than zero");
    require(cl.borrower() == msg.sender, "You are not the borrower of this credit line");
    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");
    uint256 unappliedBalance = getUSDCBalance(creditLineAddress);
    require(
      withinCreditLimit(amount, unappliedBalance, cl),
      "The borrower does not have enough credit limit for this drawdown"
    );

    uint256 balance = cl.balance();

    if (balance == 0) {
      cl.setInterestAccruedAsOf(currentTime());
      cl.setLastFullPaymentTime(currentTime());
    }

    IPool pool = config.getPool();

    // If there is any balance on the creditline that has not been applied yet, then use that first before
    // drawing down from the pool. This is to support cases where the borrower partially pays back the
    // principal before the due date, but then decides to drawdown again
    uint256 amountToTransferFromCL;
    if (unappliedBalance > 0) {
      if (amount > unappliedBalance) {
        amountToTransferFromCL = unappliedBalance;
        amount = amount.sub(unappliedBalance);
      } else {
        amountToTransferFromCL = amount;
        amount = 0;
      }
      bool success = pool.transferFrom(creditLineAddress, msg.sender, amountToTransferFromCL);
      require(success, "Failed to drawdown");
    }

    (uint256 interestOwed, uint256 principalOwed) = updateAndGetInterestAndPrincipalOwedAsOf(cl, currentTime());
    balance = balance.add(amount);

    updateCreditLineAccounting(cl, balance, interestOwed, principalOwed);

    // Must put this after we update the credit line accounting, so we're using the latest
    // interestOwed
    require(!isLate(cl, currentTime()), "Cannot drawdown when payments are past due");
    emit DrawdownMade(msg.sender, address(cl), amount.add(amountToTransferFromCL));

    if (amount > 0) {
      bool success = pool.drawdown(msg.sender, amount);
      require(success, "Failed to drawdown");
    }
  }

  /**
   * @notice Allows a borrower to repay their loan. Payment is *collected* immediately (by sending it to
   *  the individual CreditLine), but it is not *applied* unless it is after the nextDueTime, or until we assess
   *  the credit line (ie. payment period end).
   *  Any amounts over the minimum payment will be applied to outstanding principal (reducing the effective
   *  interest rate). If there is still any left over, it will remain in the USDC Balance
   *  of the CreditLine, which is held distinct from the Pool amounts, and can not be withdrawn by LP's.
   * @param creditLineAddress The credit line to be paid back
   * @param amount The amount, in USDC atomic units, that a borrower wishes to pay
   */
  function pay(address creditLineAddress, uint256 amount)
    external
    override
    whenNotPaused
    onlyValidCreditLine(creditLineAddress)
  {
    require(amount > 0, "Must pay more than zero");
    CreditLine cl = CreditLine(creditLineAddress);

    collectPayment(cl, amount);
    assessCreditLine(creditLineAddress);
  }

  /**
   * @notice Assesses a particular creditLine. This will apply payments, which will update accounting and
   *  distribute gains or losses back to the pool accordingly. This function is idempotent, and anyone
   *  is allowed to call it.
   * @param creditLineAddress The creditline that should be assessed.
   */
  function assessCreditLine(address creditLineAddress)
    public
    override
    whenNotPaused
    onlyValidCreditLine(creditLineAddress)
  {
    CreditLine cl = CreditLine(creditLineAddress);
    // Do not assess until a full period has elapsed or past due
    require(cl.balance() > 0, "Must have balance to assess credit line");

    // Don't assess credit lines early!
    if (currentTime() < cl.nextDueTime() && !isLate(cl, currentTime())) {
      return;
    }

    uint256 timeToAssess = calculateNextDueTime(cl);
    cl.setNextDueTime(timeToAssess);

    // We always want to assess for the most recently *past* nextDueTime.
    // So if the recalculation above sets the nextDueTime into the future,
    // then ensure we pass in the one just before this.
    if (timeToAssess > currentTime()) {
      uint256 secondsPerPeriod = cl.paymentPeriodInDays().mul(SECONDS_PER_DAY);
      timeToAssess = timeToAssess.sub(secondsPerPeriod);
    }
    _applyPayment(cl, getUSDCBalance(address(cl)), timeToAssess);
  }

  function applyPayment(address creditLineAddress, uint256 amount)
    external
    override
    whenNotPaused
    onlyValidCreditLine(creditLineAddress)
  {
    CreditLine cl = CreditLine(creditLineAddress);
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    _applyPayment(cl, amount, currentTime());
  }

  function migrateV1CreditLine(
    address _clToMigrate,
    address borrower,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid
  ) public onlyAdmin returns (address, address) {
    IV1CreditLine clToMigrate = IV1CreditLine(_clToMigrate);
    uint256 originalBalance = clToMigrate.balance();
    require(clToMigrate.limit() > 0, "Can't migrate empty credit line");
    require(originalBalance > 0, "Can't migrate credit line that's currently paid off");
    // Ensure it is a v1 creditline by calling a function that only exists on v1
    require(clToMigrate.nextDueBlock() > 0, "Invalid creditline");
    if (borrower == address(0)) {
      borrower = clToMigrate.borrower();
    }
    // We're migrating from 1e8 decimal precision of interest rates to 1e18
    // So multiply the legacy rates by 1e10 to normalize them.
    uint256 interestMigrationFactor = 1e10;
    uint256[] memory allowedUIDTypes;
    address pool = getGoldfinchFactory().createMigratedPool(
      borrower,
      20, // junior fee percent
      clToMigrate.limit(),
      clToMigrate.interestApr().mul(interestMigrationFactor),
      clToMigrate.paymentPeriodInDays(),
      clToMigrate.termInDays(),
      clToMigrate.lateFeeApr(),
      0,
      0,
      allowedUIDTypes
    );

    IV2CreditLine newCl = IMigratedTranchedPool(pool).migrateCreditLineToV2(
      clToMigrate,
      termEndTime,
      nextDueTime,
      interestAccruedAsOf,
      lastFullPaymentTime,
      totalInterestPaid
    );

    // Close out the original credit line
    clToMigrate.setLimit(0);
    clToMigrate.setBalance(0);

    // Some sanity checks on the migration
    require(newCl.balance() == originalBalance, "Balance did not migrate properly");
    require(newCl.interestAccruedAsOf() == interestAccruedAsOf, "Interest accrued as of did not migrate properly");
    return (address(newCl), pool);
  }

  /**
   * @notice Simple getter for the creditlines of a given underwriter
   * @param underwriterAddress The underwriter address you would like to see the credit lines of.
   */
  function getUnderwriterCreditLines(address underwriterAddress) public view returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }

  /**
   * @notice Simple getter for the creditlines of a given borrower
   * @param borrowerAddress The borrower address you would like to see the credit lines of.
   */
  function getBorrowerCreditLines(address borrowerAddress) public view returns (address[] memory) {
    return borrowers[borrowerAddress].creditLines;
  }

  /**
   * @notice This function is only meant to be used by frontends. It returns the total
   * payment due for a given creditLine as of the provided timestamp. Returns 0 if no
   * payment is due (e.g. asOf is before the nextDueTime)
   * @param creditLineAddress The creditLine to calculate the payment for
   * @param asOf The timestamp to use for the payment calculation, if it is set to 0, uses the current time
   */
  function getNextPaymentAmount(address creditLineAddress, uint256 asOf)
    external
    view
    override
    onlyValidCreditLine(creditLineAddress)
    returns (uint256)
  {
    if (asOf == 0) {
      asOf = currentTime();
    }
    CreditLine cl = CreditLine(creditLineAddress);

    if (asOf < cl.nextDueTime() && !isLate(cl, currentTime())) {
      return 0;
    }

    (uint256 interestAccrued, uint256 principalAccrued) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      asOf,
      config.getLatenessGracePeriodInDays()
    );
    return cl.interestOwed().add(interestAccrued).add(cl.principalOwed().add(principalAccrued));
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  /*
   * Internal Functions
   */

  /**
   * @notice Collects `amount` of payment for a given credit line. This sends money from the payer to the credit line.
   *  Note that payment is not *applied* when calling this function. Only collected (ie. held) for later application.
   * @param cl The CreditLine the payment will be collected for.
   * @param amount The amount, in USDC atomic units, to be collected
   */
  function collectPayment(CreditLine cl, uint256 amount) internal {
    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");

    emit PaymentCollected(msg.sender, address(cl), amount);

    bool success = config.getPool().transferFrom(msg.sender, address(cl), amount);
    require(success, "Failed to collect payment");
  }

  /**
   * @notice Applies `amount` of payment for a given credit line. This moves already collected money into the Pool.
   *  It also updates all the accounting variables. Note that interest is always paid back first, then principal.
   *  Any extra after paying the minimum will go towards existing principal (reducing the
   *  effective interest rate). Any extra after the full loan has been paid off will remain in the
   *  USDC Balance of the creditLine, where it will be automatically used for the next drawdown.
   * @param cl The CreditLine the payment will be collected for.
   * @param amount The amount, in USDC atomic units, to be applied
   * @param timestamp The timestamp on which accrual calculations should be based. This allows us
   *  to be precise when we assess a Credit Line
   */
  function _applyPayment(
    CreditLine cl,
    uint256 amount,
    uint256 timestamp
  ) internal {
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = handlePayment(
      cl,
      amount,
      timestamp
    );

    IPool pool = config.getPool();

    if (interestPayment > 0 || principalPayment > 0) {
      emit PaymentApplied(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
      pool.collectInterestAndPrincipal(address(cl), interestPayment, principalPayment);
    }
  }

  function handlePayment(
    CreditLine cl,
    uint256 paymentAmount,
    uint256 timestamp
  )
    internal
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    (uint256 interestOwed, uint256 principalOwed) = updateAndGetInterestAndPrincipalOwedAsOf(cl, timestamp);
    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      cl.balance(),
      interestOwed,
      principalOwed
    );

    uint256 newBalance = cl.balance().sub(pa.principalPayment);
    // Apply any additional payment towards the balance
    newBalance = newBalance.sub(pa.additionalBalancePayment);
    uint256 totalPrincipalPayment = cl.balance().sub(newBalance);
    uint256 paymentRemaining = paymentAmount.sub(pa.interestPayment).sub(totalPrincipalPayment);

    updateCreditLineAccounting(
      cl,
      newBalance,
      interestOwed.sub(pa.interestPayment),
      principalOwed.sub(pa.principalPayment)
    );

    assert(paymentRemaining.add(pa.interestPayment).add(totalPrincipalPayment) == paymentAmount);

    return (paymentRemaining, pa.interestPayment, totalPrincipalPayment);
  }

  function isLate(CreditLine cl, uint256 timestamp) internal view returns (bool) {
    uint256 secondsElapsedSinceFullPayment = timestamp.sub(cl.lastFullPaymentTime());
    return secondsElapsedSinceFullPayment > cl.paymentPeriodInDays().mul(SECONDS_PER_DAY);
  }

  function getGoldfinchFactory() internal view returns (GoldfinchFactory) {
    return GoldfinchFactory(config.getAddress(uint256(ConfigOptions.Addresses.GoldfinchFactory)));
  }

  function updateAndGetInterestAndPrincipalOwedAsOf(CreditLine cl, uint256 timestamp)
    internal
    returns (uint256, uint256)
  {
    (uint256 interestAccrued, uint256 principalAccrued) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      timestamp,
      config.getLatenessGracePeriodInDays()
    );
    if (interestAccrued > 0) {
      // If we've accrued any interest, update interestAccruedAsOf to the time that we've
      // calculated interest for. If we've not accrued any interest, then we keep the old value so the next
      // time the entire period is taken into account.
      cl.setInterestAccruedAsOf(timestamp);
    }
    return (cl.interestOwed().add(interestAccrued), cl.principalOwed().add(principalAccrued));
  }

  function withinCreditLimit(
    uint256 amount,
    uint256 unappliedBalance,
    CreditLine cl
  ) internal view returns (bool) {
    return cl.balance().add(amount).sub(unappliedBalance) <= cl.limit();
  }

  function withinTransactionLimit(uint256 amount) internal view returns (bool) {
    return amount <= config.getNumber(uint256(ConfigOptions.Numbers.TransactionLimit));
  }

  function calculateNewTermEndTime(CreditLine cl, uint256 balance) internal view returns (uint256) {
    // If there's no balance, there's no loan, so there's no term end time
    if (balance == 0) {
      return 0;
    }
    // Don't allow any weird bugs where we add to your current end time. This
    // function should only be used on new credit lines, when we are setting them up
    if (cl.termEndTime() != 0) {
      return cl.termEndTime();
    }
    return currentTime().add(SECONDS_PER_DAY.mul(cl.termInDays()));
  }

  function calculateNextDueTime(CreditLine cl) internal view returns (uint256) {
    uint256 secondsPerPeriod = cl.paymentPeriodInDays().mul(SECONDS_PER_DAY);
    uint256 balance = cl.balance();
    uint256 nextDueTime = cl.nextDueTime();
    uint256 curTimestamp = currentTime();
    // You must have just done your first drawdown
    if (nextDueTime == 0 && balance > 0) {
      return curTimestamp.add(secondsPerPeriod);
    }

    // Active loan that has entered a new period, so return the *next* nextDueTime.
    // But never return something after the termEndTime
    if (balance > 0 && curTimestamp >= nextDueTime) {
      uint256 secondsToAdvance = (curTimestamp.sub(nextDueTime).div(secondsPerPeriod)).add(1).mul(secondsPerPeriod);
      nextDueTime = nextDueTime.add(secondsToAdvance);
      return Math.min(nextDueTime, cl.termEndTime());
    }

    // Your paid off, or have not taken out a loan yet, so no next due time.
    if (balance == 0 && nextDueTime != 0) {
      return 0;
    }
    // Active loan in current period, where we've already set the nextDueTime correctly, so should not change.
    if (balance > 0 && curTimestamp < nextDueTime) {
      return nextDueTime;
    }
    revert("Error: could not calculate next due time.");
  }

  function currentTime() internal view virtual returns (uint256) {
    return block.timestamp;
  }

  function underwriterCanCreateThisCreditLine(uint256 newAmount, Underwriter storage underwriter)
    internal
    view
    returns (bool)
  {
    uint256 underwriterLimit = underwriter.governanceLimit;
    require(underwriterLimit != 0, "underwriter does not have governance limit");
    uint256 creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    uint256 totalToBeExtended = creditCurrentlyExtended.add(newAmount);
    return totalToBeExtended <= underwriterLimit;
  }

  function withinMaxUnderwriterLimit(uint256 amount) internal view returns (bool) {
    return amount <= config.getNumber(uint256(ConfigOptions.Numbers.MaxUnderwriterLimit));
  }

  function getCreditCurrentlyExtended(Underwriter storage underwriter) internal view returns (uint256) {
    uint256 creditExtended;
    uint256 length = underwriter.creditLines.length;
    for (uint256 i = 0; i < length; i++) {
      CreditLine cl = CreditLine(underwriter.creditLines[i]);
      creditExtended = creditExtended.add(cl.limit());
    }
    return creditExtended;
  }

  function updateCreditLineAccounting(
    CreditLine cl,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) internal nonReentrant {
    // subtract cl from total loans outstanding
    totalLoansOutstanding = totalLoansOutstanding.sub(cl.balance());

    cl.setBalance(balance);
    cl.setInterestOwed(interestOwed);
    cl.setPrincipalOwed(principalOwed);

    // This resets lastFullPaymentTime. These conditions assure that they have
    // indeed paid off all their interest and they have a real nextDueTime. (ie. creditline isn't pre-drawdown)
    uint256 nextDueTime = cl.nextDueTime();
    if (interestOwed == 0 && nextDueTime != 0) {
      // If interest was fully paid off, then set the last full payment as the previous due time
      uint256 mostRecentLastDueTime;
      if (currentTime() < nextDueTime) {
        uint256 secondsPerPeriod = cl.paymentPeriodInDays().mul(SECONDS_PER_DAY);
        mostRecentLastDueTime = nextDueTime.sub(secondsPerPeriod);
      } else {
        mostRecentLastDueTime = nextDueTime;
      }
      cl.setLastFullPaymentTime(mostRecentLastDueTime);
    }

    // Add new amount back to total loans outstanding
    totalLoansOutstanding = totalLoansOutstanding.add(balance);

    cl.setTermEndTime(calculateNewTermEndTime(cl, balance)); // pass in balance as a gas optimization
    cl.setNextDueTime(calculateNextDueTime(cl));
  }

  function getUSDCBalance(address _address) internal view returns (uint256) {
    return config.getUSDC().balanceOf(_address);
  }

  modifier onlyValidCreditLine(address clAddress) {
    require(creditLines[clAddress] != address(0), "Unknown credit line");
    _;
  }
}
