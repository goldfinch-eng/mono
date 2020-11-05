// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
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
    Underwriter storage underwriter = underwriters[underwriterAddress];
    require(withinMaxUnderwriterLimit(limit), "This limit is greater than the max allowed by the protocol");
    underwriter.governanceLimit = limit;
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
    uint256 _termInDays
  ) external override whenNotPaused {
    Underwriter storage underwriter = underwriters[msg.sender];
    Borrower storage borrower = borrowers[_borrower];
    require(underwriterCanCreateThisCreditLine(_limit, underwriter), "The underwriter cannot create this credit line");

    bytes memory arguments = abi.encodeWithSignature(
      "initialize(address,address,address,uint256,uint256,uint256,uint256)",
      address(this),
      _borrower,
      msg.sender,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays
    );

    address clAddress = getCreditLineFactory().createCreditLine(arguments);
    CreditLine cl = CreditLine(clAddress);

    underwriter.creditLines.push(address(cl));
    borrower.creditLines.push(address(cl));
    emit CreditLineCreated(_borrower, address(cl));

    cl.authorizePool(address(config));
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
  ) external override whenNotPaused {
    if (addressToSendTo == address(0)) {
      addressToSendTo = msg.sender;
    }
    CreditLine cl = CreditLine(creditLineAddress);
    require(amount > 0, "Must drawdown more than zero");
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");
    require(withinCreditLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");

    if (cl.balance() == 0) {
      cl.setLastUpdatedBlock(block.number);
    }
    // Must get the interest and principal accrued prior to adding to the balance.
    (uint256 interestOwed, uint256 principalOwed) = getInterestAndPrincipalOwedAsOf(cl, block.number);
    uint256 balance = cl.balance().add(amount);

    updateCreditLineAccounting(cl, balance, interestOwed, principalOwed);

    emit DrawdownMade(msg.sender, address(cl), amount);

    bool success = config.getPool().transferFrom(config.poolAddress(), addressToSendTo, amount);
    require(success, "Failed to drawdown");
  }

  /**
   * @notice Allows a borrower to repay their loan. Payment is *collected* immediately (by sending it to
   *  the individual CreditLine), but it is not *applied* unless it is after the nextDueBlock, or until we assess
   *  the credit line (ie. payment period end).
   *  Any amounts over the minimum payment will be applied to outstanding principal (reducing the effective
   *  interest rate). If there is still any left over, it will remain in the "collectedPaymentBalance"
   *  of the CreditLine, which is held distinct from the Pool amounts, and can not be withdrawn by LP's.
   * @param creditLineAddress The credit line to be paid back
   * @param amount The amount, in USDC atomic units, that a borrower wishes to pay
   */
  function pay(address creditLineAddress, uint256 amount) external override whenNotPaused {
    require(amount > 0, "Must pay more than zero");
    CreditLine cl = CreditLine(creditLineAddress);

    collectPayment(cl, amount);

    if (block.number < cl.nextDueBlock()) {
      return;
    }
    applyPayment(cl, cl.collectedPaymentBalance(), block.number);
  }

  /**
   * @notice Assesses a particular creditLine. This will apply payments, which will update accounting and
   *  distribute gains or losses back to the pool accordingly. This function is idempotent, and anyone
   *  is allowed to call it.
   * @param creditLineAddress The creditline that should be assessed.
   */
  function assessCreditLine(address creditLineAddress) external override whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);
    // Do not assess until a full period has elapsed
    if (block.number < cl.nextDueBlock()) {
      return;
    }
    applyPayment(cl, cl.collectedPaymentBalance(), cl.nextDueBlock());
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
    require(config.getUSDC().balanceOf(msg.sender) > amount, "You have insufficent balance for this payment");

    uint256 newCollectedPaymentBalance = cl.collectedPaymentBalance().add(amount);
    cl.setCollectedPaymentBalance(newCollectedPaymentBalance);

    emit PaymentCollected(msg.sender, address(cl), amount);

    bool success = config.getPool().transferFrom(msg.sender, address(cl), amount);
    require(success, "Failed to collect payment");
  }

  /**
   * @notice Applies `amount` of payment for a given credit line. This moves already collected money into the Pool.
   *  It also updates all the accounting variables. Note that interest is always paid back first, then principal.
   *  Any extra after paying the minimum will go towards existing principal (reducing the
   *  effective interest rate). Any extra after the full loan has been paid off will remain in the
   *  collectedPaymentBalance of the creditLine, where it will be automatically used for the next drawdown.
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
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = handlePayment(
      cl,
      amount,
      blockNumber
    );

    // There can only be payment remaining if we're paid more than total owed.
    // Just add it to the collected payment balance. We could also send this back to the borrower (
    // but since assess can be called by anyone, it's better to keep the funds within the contract)
    cl.setCollectedPaymentBalance(paymentRemaining);

    if (cl.principalOwed() > 0 || cl.interestOwed() > 0) {
      handleLatePayments(cl);
    }

    bool paymentApplied = false;
    if (interestPayment > 0) {
      paymentApplied = true;
      config.getPool().collectInterestRepayment(address(cl), interestPayment);
    }
    if (principalPayment > 0) {
      paymentApplied = true;
      config.getPool().collectPrincipalRepayment(address(cl), principalPayment);
    }

    if (paymentApplied) {
      emit PaymentApplied(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
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
    (uint256 interestOwed, uint256 principalOwed) = getInterestAndPrincipalOwedAsOf(cl, asOfBlock);
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

  function handleLatePayments(CreditLine) internal pure {
    // No op for now;
    return;
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

  function getInterestAndPrincipalOwedAsOf(CreditLine cl, uint256 blockNumber)
    internal
    view
    returns (uint256, uint256)
  {
    (uint256 interestAccrued, uint256 principalAccrued) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      blockNumber
    );
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
    if (cl.balance() <= 0) {
      return 0;
    }
    // Don't allow any weird bugs where we add to your current end block. This
    // function should only be used on new credit lines, when we are setting them up
    if (cl.termEndBlock() != 0) {
      return cl.termEndBlock();
    }
    return block.number.add(BLOCKS_PER_DAY.mul(cl.termInDays()));
  }

  function calculateNextDueBlock(CreditLine cl) internal view returns (uint256) {
    uint256 blocksPerPeriod = cl.paymentPeriodInDays().mul(BLOCKS_PER_DAY);

    // Your paid off, or have not taken out a loan yet, so no next due block.
    if (cl.balance() <= 0 && cl.nextDueBlock() != 0) {
      return 0;
    }
    // You must have just done your first drawdown
    if (cl.nextDueBlock() == 0 && cl.balance() > 0) {
      return block.number.add(blocksPerPeriod);
    }
    // Active loan that has entered a new period, so return the *next* nextDueBlock
    if (cl.balance() > 0 && block.number >= cl.nextDueBlock()) {
      return cl.nextDueBlock().add(blocksPerPeriod);
    }
    // Active loan in current period, where we've already set the nextDueBlock correctly, so should not change.
    if (cl.balance() > 0 && block.number < cl.nextDueBlock()) {
      return cl.nextDueBlock();
    }
  }

  function underwriterCanCreateThisCreditLine(uint256 newAmount, Underwriter storage underwriter)
    internal
    view
    returns (bool)
  {
    uint256 creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    uint256 totalToBeExtended = creditCurrentlyExtended.add(newAmount);
    return totalToBeExtended <= underwriter.governanceLimit;
  }

  function withinMaxUnderwriterLimit(uint256 amount) internal view returns (bool) {
    return amount <= config.getNumber(uint256(ConfigOptions.Numbers.MaxUnderwriterLimit));
  }

  function getCreditCurrentlyExtended(Underwriter storage underwriter) internal view returns (uint256) {
    uint256 creditExtended = 0;
    for (uint256 i = 0; i < underwriter.creditLines.length; i++) {
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
    cl.setLastUpdatedBlock(block.number);

    addCLToTotalLoansOutstanding(cl);

    cl.setTermEndBlock(calculateNewTermEndBlock(cl));
    cl.setNextDueBlock(calculateNextDueBlock(cl));
  }
}
