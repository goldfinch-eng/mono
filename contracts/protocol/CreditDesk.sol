// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "./Accountant.sol";
import "./CreditLine.sol";
import "./CreditLineFactory.sol";

/**
 * @title Goldfinch's CreditDesk contract
 * @notice Main entry point for borrowers and underwriters.
 *  Handles key logic for creating CreditLine's, borrowing money, repayment, etc.
 * @author Goldfinch
 */

contract CreditDesk is BaseUpgradeablePausable, ICreditDesk {
  // Approximate number of blocks per day
  uint256 public constant BLOCKS_PER_DAY = 5760;
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
   * @notice Allows an underwriter to create a new CreditLine for a single borrower
   * @param _borrower The borrower for whom the CreditLine will be created
   * @param _limit The maximum amount a borrower can drawdown from this CreditLine
   * @param _interestApr The interest amount, on an annualized basis (APR, so non-compounding), expressed as an integer.
   *  We assume 8 digits of precision. For example, to submit 15.34%, you would pass up 15340000,
   *  and 5.34% would be 5340000
   * @param _paymentPeriodInDays How many days in each payment period.
   *  ie. the frequency with which they need to make payments.
   * @param _termInDays Number of days in the credit term. It is used to set the `termEndBlock` upon first drawdown.
   *  ie. The credit line should be fully paid off {_termIndays} days after the first drawdown.
   * @param _lateFeeApr The additional interest you will pay if you are late. For example, if this is 3%, and your
   *  normal rate is 15%, then you will pay 18% while you are late.
   *
   * Requirements:
   *
   * - the caller must be an underwriter with enough limit (see `setUnderwriterGovernanceLimit`)
   */
  function createCreditLine(
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public override whenNotPaused returns (address) {
    Underwriter storage underwriter = underwriters[msg.sender];
    Borrower storage borrower = borrowers[_borrower];
    require(underwriterCanCreateThisCreditLine(_limit, underwriter), "The underwriter cannot create this credit line");

    address clAddress = getCreditLineFactory().createCreditLine("");
    CreditLine cl = CreditLine(clAddress);
    cl.initialize(
      address(this),
      _borrower,
      msg.sender,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr
    );

    underwriter.creditLines.push(clAddress);
    borrower.creditLines.push(clAddress);
    creditLines[clAddress] = clAddress;
    emit CreditLineCreated(_borrower, clAddress);

    cl.grantRole(keccak256("OWNER_ROLE"), config.protocolAdminAddress());
    cl.authorizePool(address(config));
    return clAddress;
  }

  /**
   * @notice Allows a borrower to drawdown on their creditline.
   *  `amount` USDC is sent to the borrower, and the credit line accounting is updated.
   * @param amount The amount, in USDC atomic units, that a borrower wishes to drawdown
   * @param creditLineAddress The creditline from which they would like to drawdown
   * @param addressToSendTo The address where they would like the funds sent. If the zero address is passed,
   *  it will be defaulted to the borrower's address (msg.sender). This is a convenience feature for when they would
   *  like the funds sent to an exchange or alternate wallet, different from the authentication address
   *
   * Requirements:
   *
   * - the caller must be the borrower on the creditLine
   */
  function drawdown(
    uint256 amount,
    address creditLineAddress,
    address addressToSendTo
  ) external override whenNotPaused onlyValidCreditLine(creditLineAddress) {
    CreditLine cl = CreditLine(creditLineAddress);
    Borrower storage borrower = borrowers[msg.sender];
    require(borrower.creditLines.length > 0, "No credit lines exist for this borrower");
    require(amount > 0, "Must drawdown more than zero");
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");
    require(withinCreditLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");

    if (addressToSendTo == address(0)) {
      addressToSendTo = msg.sender;
    }

    if (cl.balance() == 0) {
      cl.setInterestAccruedAsOfBlock(blockNumber());
      cl.setLastFullPaymentBlock(blockNumber());
    }
    // Must get the interest and principal accrued prior to adding to the balance.
    (uint256 interestOwed, uint256 principalOwed) = updateAndGetInterestAndPrincipalOwedAsOf(cl, blockNumber());
    uint256 balance = cl.balance().add(amount);

    updateCreditLineAccounting(cl, balance, interestOwed, principalOwed);

    // Must put this after we update the credit line accounting, so we're using the latest
    // interestOwed
    require(!isLate(cl), "Cannot drawdown when payments are past due");
    emit DrawdownMade(msg.sender, address(cl), amount);

    bool success = config.getPool().transferFrom(config.poolAddress(), addressToSendTo, amount);
    require(success, "Failed to drawdown");
  }

  /**
   * @notice Allows a borrower to repay their loan. Payment is *collected* immediately (by sending it to
   *  the individual CreditLine), but it is not *applied* unless it is after the nextDueBlock, or until we assess
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
    if (blockNumber() < cl.nextDueBlock() && !isLate(cl)) {
      return;
    }

    cl.setNextDueBlock(calculateNextDueBlock(cl));
    uint256 blockToAssess = cl.nextDueBlock();

    // We always want to assess for the most recently *past* nextDueBlock.
    // So if the recalculation above sets the nextDueBlock into the future,
    // then ensure we pass in the one just before this.
    if (cl.nextDueBlock() > blockNumber()) {
      uint256 blocksPerPeriod = cl.paymentPeriodInDays().mul(BLOCKS_PER_DAY);
      blockToAssess = cl.nextDueBlock().sub(blocksPerPeriod);
    }
    applyPayment(cl, getUSDCBalance(address(cl)), blockToAssess);
  }

  function migrateCreditLine(
    CreditLine clToMigrate,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public onlyAdmin {
    require(clToMigrate.limit() > 0, "Can't migrate empty credit line");
    address newClAddress =
      createCreditLine(_borrower, _limit, _interestApr, _paymentPeriodInDays, _termInDays, _lateFeeApr);

    CreditLine newCl = CreditLine(newClAddress);

    // Set accounting state vars.
    newCl.setBalance(clToMigrate.balance());
    newCl.setInterestOwed(clToMigrate.interestOwed());
    newCl.setPrincipalOwed(clToMigrate.principalOwed());
    newCl.setTermEndBlock(clToMigrate.termEndBlock());
    newCl.setNextDueBlock(clToMigrate.nextDueBlock());
    newCl.setInterestAccruedAsOfBlock(clToMigrate.interestAccruedAsOfBlock());
    newCl.setWritedownAmount(clToMigrate.writedownAmount());
    newCl.setLastFullPaymentBlock(clToMigrate.lastFullPaymentBlock());

    // Close out the original credit line
    clToMigrate.setLimit(0);
    clToMigrate.setBalance(0);
    bool success =
      config.getPool().transferFrom(
        address(clToMigrate),
        address(newCl),
        config.getUSDC().balanceOf(address(clToMigrate))
      );
    require(success, "Failed to transfer funds");
  }

  // Public View Functions (Getters)

  /**
   * @notice Simple getter for the creditlines of a given underwriter
   * @param underwriterAddress The underwriter address you would like to see the credit lines of.
   */
  function getUnderwriterCreditLines(address underwriterAddress) public view whenNotPaused returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }

  /**
   * @notice Simple getter for the creditlines of a given borrower
   * @param borrowerAddress The borrower address you would like to see the credit lines of.
   */
  function getBorrowerCreditLines(address borrowerAddress) public view whenNotPaused returns (address[] memory) {
    return borrowers[borrowerAddress].creditLines;
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
    require(config.getUSDC().balanceOf(msg.sender) >= amount, "You have insufficent balance for this payment");

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
   * @param blockNumber The blockNumber on which accrual calculations should be based. This allows us
   *  to be precise when we assess a Credit Line
   */
  function applyPayment(
    CreditLine cl,
    uint256 amount,
    uint256 blockNumber
  ) internal {
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) =
      handlePayment(cl, amount, blockNumber);

    updateWritedownAmounts(cl);

    if (interestPayment > 0) {
      emit PaymentApplied(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
      config.getPool().collectInterestRepayment(address(cl), interestPayment);
    }
    if (principalPayment > 0) {
      emit PaymentApplied(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
      config.getPool().collectPrincipalRepayment(address(cl), principalPayment);
    }
  }

  function handlePayment(
    CreditLine cl,
    uint256 paymentAmount,
    uint256 asOfBlock
  )
    internal
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    (uint256 interestOwed, uint256 principalOwed) = updateAndGetInterestAndPrincipalOwedAsOf(cl, asOfBlock);
    Accountant.PaymentAllocation memory pa =
      Accountant.allocatePayment(paymentAmount, cl.balance(), interestOwed, principalOwed);

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

  function updateWritedownAmounts(CreditLine cl) internal {
    (uint256 writedownPercent, uint256 writedownAmount) =
      Accountant.calculateWritedownFor(
        cl,
        blockNumber(),
        config.getLatenessGracePeriodInDays(),
        config.getLatenessMaxDays()
      );

    if (writedownPercent == 0 && cl.writedownAmount() == 0) {
      return;
    }
    int256 writedownDelta = int256(cl.writedownAmount()) - int256(writedownAmount);
    cl.setWritedownAmount(writedownAmount);
    if (writedownDelta > 0) {
      // If writedownDelta is positive, that means we got money back. So subtract from totalWritedowns.
      totalWritedowns = totalWritedowns.sub(uint256(writedownDelta));
    } else {
      totalWritedowns = totalWritedowns.add(uint256(writedownDelta * -1));
    }
    config.getPool().distributeLosses(address(cl), writedownDelta);
  }

  function isLate(CreditLine cl) internal view returns (bool) {
    uint256 blocksElapsedSinceFullPayment = blockNumber().sub(cl.lastFullPaymentBlock());
    return blocksElapsedSinceFullPayment > cl.paymentPeriodInDays().mul(BLOCKS_PER_DAY);
  }

  function getCreditLineFactory() internal view returns (CreditLineFactory) {
    return CreditLineFactory(config.getAddress(uint256(ConfigOptions.Addresses.CreditLineFactory)));
  }

  function subtractClFromTotalLoansOutstanding(CreditLine cl) internal {
    totalLoansOutstanding = totalLoansOutstanding.sub(cl.balance());
  }

  function addCLToTotalLoansOutstanding(CreditLine cl) internal {
    totalLoansOutstanding = totalLoansOutstanding.add(cl.balance());
  }

  function updateAndGetInterestAndPrincipalOwedAsOf(CreditLine cl, uint256 blockNumber)
    internal
    returns (uint256, uint256)
  {
    (uint256 interestAccrued, uint256 principalAccrued) =
      Accountant.calculateInterestAndPrincipalAccrued(cl, blockNumber, config.getLatenessGracePeriodInDays());
    if (interestAccrued > 0) {
      // If we've accrued any interest, update interestAccruedAsOfBLock to the block that we've
      // calculated interest for. If we've not accrued any interest, then we keep the old value so the next
      // time the entire period is taken into account.
      cl.setInterestAccruedAsOfBlock(blockNumber);
    }
    return (cl.interestOwed().add(interestAccrued), cl.principalOwed().add(principalAccrued));
  }

  function withinCreditLimit(uint256 amount, CreditLine cl) internal view returns (bool) {
    return cl.balance().add(amount) <= cl.limit();
  }

  function withinTransactionLimit(uint256 amount) internal view returns (bool) {
    return amount <= config.getNumber(uint256(ConfigOptions.Numbers.TransactionLimit));
  }

  function calculateNewTermEndBlock(CreditLine cl) internal view returns (uint256) {
    // If there's no balance, there's no loan, so there's no term end block
    if (cl.balance() == 0) {
      return 0;
    }
    // Don't allow any weird bugs where we add to your current end block. This
    // function should only be used on new credit lines, when we are setting them up
    if (cl.termEndBlock() != 0) {
      return cl.termEndBlock();
    }
    return blockNumber().add(BLOCKS_PER_DAY.mul(cl.termInDays()));
  }

  function calculateNextDueBlock(CreditLine cl) internal view returns (uint256) {
    uint256 blocksPerPeriod = cl.paymentPeriodInDays().mul(BLOCKS_PER_DAY);

    // Your paid off, or have not taken out a loan yet, so no next due block.
    if (cl.balance() == 0 && cl.nextDueBlock() != 0) {
      return 0;
    }
    // You must have just done your first drawdown
    if (cl.nextDueBlock() == 0 && cl.balance() > 0) {
      return blockNumber().add(blocksPerPeriod);
    }
    // Active loan that has entered a new period, so return the *next* nextDueBlock.
    // But never return something after the termEndBlock
    if (cl.balance() > 0 && blockNumber() >= cl.nextDueBlock()) {
      uint256 blocksToAdvance = (blockNumber().sub(cl.nextDueBlock()).div(blocksPerPeriod)).add(1).mul(blocksPerPeriod);
      uint256 nextDueBlock = cl.nextDueBlock().add(blocksToAdvance);
      return Math.min(nextDueBlock, cl.termEndBlock());
    }
    // Active loan in current period, where we've already set the nextDueBlock correctly, so should not change.
    if (cl.balance() > 0 && blockNumber() < cl.nextDueBlock()) {
      return cl.nextDueBlock();
    }
    revert("Error: could not calculate next due block.");
  }

  function blockNumber() internal view virtual returns (uint256) {
    return block.number;
  }

  function underwriterCanCreateThisCreditLine(uint256 newAmount, Underwriter storage underwriter)
    internal
    view
    returns (bool)
  {
    require(underwriter.governanceLimit != 0, "underwriter does not have governance limit");
    uint256 creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    uint256 totalToBeExtended = creditCurrentlyExtended.add(newAmount);
    return totalToBeExtended <= underwriter.governanceLimit;
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
    subtractClFromTotalLoansOutstanding(cl);

    cl.setBalance(balance);
    cl.setInterestOwed(interestOwed);
    cl.setPrincipalOwed(principalOwed);

    // This resets lastFullPaymentBlock. These conditions assure that they have
    // indeed paid off all their interest and they have a real nextDueBlock. (ie. creditline isn't pre-drawdown)
    if (cl.interestOwed() == 0 && cl.nextDueBlock() != 0) {
      // If interest was fully paid off, then set the last full payment as the previous due block
      uint256 mostRecentLastDueBlock;
      if (blockNumber() < cl.nextDueBlock()) {
        uint256 blocksPerPeriod = cl.paymentPeriodInDays().mul(BLOCKS_PER_DAY);
        mostRecentLastDueBlock = cl.nextDueBlock().sub(blocksPerPeriod);
      } else {
        mostRecentLastDueBlock = cl.nextDueBlock();
      }
      cl.setLastFullPaymentBlock(mostRecentLastDueBlock);
    }

    addCLToTotalLoansOutstanding(cl);

    cl.setTermEndBlock(calculateNewTermEndBlock(cl));
    cl.setNextDueBlock(calculateNextDueBlock(cl));
  }

  function getUSDCBalance(address _address) internal returns (uint256) {
    return config.getUSDC().balanceOf(_address);
  }

  modifier onlyValidCreditLine(address clAddress) {
    require(creditLines[clAddress] != address(0), "Unknown credit line");
    _;
  }
}
