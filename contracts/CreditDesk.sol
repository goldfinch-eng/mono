// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./Pool.sol";
import "./Accountant.sol";
import "./CreditLine.sol";
import "./OwnerPausable.sol";

contract CreditDesk is Initializable, OwnableUpgradeSafe, OwnerPausable {
  using SafeMath for uint256;

  // Approximate number of blocks
  uint256 public constant blocksPerDay = 5760;
  address public poolAddress;
  uint256 public maxUnderwriterLimit = 0;
  uint256 public transactionLimit = 0;

  struct Underwriter {
    uint256 governanceLimit;
    address[] creditLines;
  }

  struct Borrower {
    address[] creditLines;
  }

  event PaymentMade(
    address indexed payer,
    address indexed creditLine,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount
  );
  event PrepaymentMade(address indexed payer, address indexed creditLine, uint256 prepaymentAmount);
  event DrawdownMade(address indexed borrower, address indexed creditLine, uint256 drawdownAmount);
  event CreditLineCreated(address indexed borrower, address indexed creditLine);
  event PoolAddressUpdated(address indexed oldAddress, address indexed newAddress);
  event GovernanceUpdatedUnderwriterLimit(address indexed underwriter, uint256 newLimit);
  event LimitChanged(address indexed owner, string limitType, uint256 amount);

  mapping(address => Underwriter) public underwriters;
  mapping(address => Borrower) private borrowers;

  function initialize(address _poolAddress) public initializer {
    __Ownable_init();
    __OwnerPausable__init();
    setPoolAddress(_poolAddress);
  }

  function setUnderwriterGovernanceLimit(address underwriterAddress, uint256 limit) external onlyOwner whenNotPaused {
    Underwriter storage underwriter = underwriters[underwriterAddress];
    require(withinMaxUnderwriterLimit(limit), "This limit is greater than the max allowed by the protocol");
    underwriter.governanceLimit = limit;
    emit GovernanceUpdatedUnderwriterLimit(underwriterAddress, limit);
  }

  function createCreditLine(
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _minCollateralPercent,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays
  ) external whenNotPaused {
    Underwriter storage underwriter = underwriters[msg.sender];
    Borrower storage borrower = borrowers[_borrower];
    require(underwriterCanCreateThisCreditLine(_limit, underwriter), "The underwriter cannot create this credit line");

    CreditLine cl = new CreditLine();
    cl.initialize(
      _borrower,
      msg.sender,
      _limit,
      _interestApr,
      _minCollateralPercent,
      _paymentPeriodInDays,
      _termInDays
    );
    cl.authorizePool(poolAddress);

    underwriter.creditLines.push(address(cl));
    borrower.creditLines.push(address(cl));
    emit CreditLineCreated(_borrower, address(cl));
  }

  function drawdown(uint256 amount, address creditLineAddress) external whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    // Not strictly necessary, but provides a better error message to the user
    require(getPool().enoughBalance(poolAddress, amount), "Pool does not have enough balance for this drawdown");
    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");
    require(withinCreditLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");

    if (cl.balance() == 0) {
      cl.setTermEndBlock(calculateNewTermEndBlock(cl));
      cl.setNextDueBlock(calculateNextDueBlock(cl));
    }
    (uint256 interestOwed, uint256 principalOwed) = getInterestAndPrincipalOwedAsOf(cl, block.number);
    uint256 balance = cl.balance().add(amount);

    updateCreditLineAccounting(cl, balance, interestOwed, principalOwed);
    getPool().transferFrom(poolAddress, msg.sender, amount);

    emit DrawdownMade(msg.sender, address(cl), amount);
  }

  function pay(address creditLineAddress, uint256 amount) external payable whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);

    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");
    // Not strictly necessary, but provides a faster/better error message to the user
    require(getPool().enoughBalance(msg.sender, amount), "You have insufficent balance for this payment");

    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = handlePayment(
      cl,
      amount,
      block.number,
      true
    );
    if (paymentRemaining > 0) {
      getPool().transferFrom(msg.sender, creditLineAddress, paymentRemaining);
      cl.setCollateralBalance(cl.collateralBalance().add(paymentRemaining));
    }
    if (interestPayment > 0) {
      getPool().collectInterestRepayment(msg.sender, interestPayment);
    }
    if (principalPayment > 0) {
      getPool().collectPrincipalRepayment(msg.sender, principalPayment);
    }

    emit PaymentMade(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
  }

  function prepay(address payable creditLineAddress, uint256 amount) external payable whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);

    require(withinTransactionLimit(amount), "Amount is over the per-transaction limit");

    getPool().transferFrom(msg.sender, creditLineAddress, amount);
    uint256 newPrepaymentBalance = cl.prepaymentBalance().add(amount);
    cl.setPrepaymentBalance(newPrepaymentBalance);

    emit PrepaymentMade(msg.sender, address(cl), amount);
  }

  function addCollateral(address payable creditLineAddress, uint256 amount) external payable whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);

    getPool().transferFrom(msg.sender, creditLineAddress, amount);
    uint256 newCollateralBalance = cl.collateralBalance().add(amount);
    cl.setCollateralBalance(newCollateralBalance);
  }

  function assessCreditLine(address creditLineAddress) external whenNotPaused {
    CreditLine cl = CreditLine(creditLineAddress);
    // Do not assess until a full period has elapsed
    if (block.number < cl.nextDueBlock()) {
      return;
    }

    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = handlePayment(
      cl,
      cl.prepaymentBalance(),
      cl.nextDueBlock(),
      false
    );

    cl.setPrepaymentBalance(paymentRemaining);
    getPool().collectInterestRepayment(msg.sender, interestPayment);
    getPool().collectPrincipalRepayment(msg.sender, principalPayment);
    cl.setNextDueBlock(calculateNextDueBlock(cl));
    if (cl.principalOwed() > 0) {
      handleLatePayments(cl);
    }
    emit PaymentMade(cl.borrower(), address(cl), interestPayment, principalPayment, paymentRemaining);
  }

  function setPoolAddress(address newPoolAddress) public onlyOwner whenNotPaused returns (address) {
    // Sanity check the new address;
    Pool(newPoolAddress).totalShares();

    emit PoolAddressUpdated(poolAddress, newPoolAddress);
    return poolAddress = newPoolAddress;
  }

  function setMaxUnderwriterLimit(uint256 amount) public onlyOwner whenNotPaused {
    maxUnderwriterLimit = amount;
    emit LimitChanged(msg.sender, "maxUnderwriterLimit", amount);
  }

  function setTransactionLimit(uint256 amount) public onlyOwner whenNotPaused {
    transactionLimit = amount;
    emit LimitChanged(msg.sender, "transactionLimit", amount);
  }

  function setPoolTotalFundsLimit(uint256 amount) public onlyOwner whenNotPaused {
    getPool().setTotalFundsLimit(amount);
  }

  // Public View Functions (Getters)

  function getUnderwriterCreditLines(address underwriterAddress) public view whenNotPaused returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }

  function getBorrowerCreditLines(address borrowerAddress) public view whenNotPaused returns (address[] memory) {
    return borrowers[borrowerAddress].creditLines;
  }

  /*
   * Internal Functions
   */

  function handlePayment(
    CreditLine cl,
    uint256 paymentAmount,
    uint256 asOfBlock,
    bool allowFullBalancePayOff
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
    if (allowFullBalancePayOff) {
      newBalance = newBalance.sub(pa.additionalBalancePayment);
    }
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

  function handleLatePayments(CreditLine cl) internal {
    // No op for now;
  }

  function getPool() internal view returns (Pool) {
    return Pool(poolAddress);
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
    return amount <= transactionLimit;
  }

  function calculateNewTermEndBlock(CreditLine cl) internal view returns (uint256) {
    return block.number.add(blocksPerDay.mul(cl.termInDays()));
  }

  function calculateNextDueBlock(CreditLine cl) internal view returns (uint256) {
    uint256 blocksPerPeriod = cl.paymentPeriodInDays().mul(blocksPerDay);
    uint256 currentNextDueBlock;
    if (cl.nextDueBlock() != 0) {
      currentNextDueBlock = cl.nextDueBlock();
    } else {
      currentNextDueBlock = block.number;
    }
    return currentNextDueBlock.add(blocksPerPeriod);
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
    return amount <= maxUnderwriterLimit;
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
  ) internal {
    cl.setBalance(balance);
    cl.setInterestOwed(interestOwed);
    cl.setPrincipalOwed(principalOwed);
    cl.setLastUpdatedBlock(block.number);

    if (balance == 0) {
      cl.setTermEndBlock(0);
      cl.setNextDueBlock(0);
    }
  }
}
