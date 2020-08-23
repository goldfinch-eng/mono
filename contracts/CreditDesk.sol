// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "./Pool.sol";
import "./CreditLine.sol";
import "./external/FPMath.sol";

contract CreditDesk is Ownable {
  using SafeMath for uint256;

  // Approximate number of blocks
  uint public constant blocksPerDay = 5760;
  uint public constant blocksPerYear = (blocksPerDay * 365);
  uint public constant interestDecimals = 1e18;
  address public poolAddress;

  struct Underwriter {
    uint governanceLimit;
    address[] creditLines;
  }

  struct Borrower {
    address[] creditLines;
  }

  struct PaymentAllocation {
    uint interestPayment;
    uint principalPayment;
    uint additionalBalancePayment;
  }

  mapping(address => Underwriter) public underwriters;

  mapping(address => Borrower) private borrowers;

  function setUnderwriterGovernanceLimit(address underwriterAddress, uint limit) external onlyOwner {
    Underwriter storage underwriter = underwriters[underwriterAddress];
    underwriter.governanceLimit = limit;
  }

  function getUnderwriterCreditLines(address underwriterAddress) public view returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }

  function getBorrowerCreditLines(address borrowerAddress) public view returns (address[] memory) {
    return borrowers[borrowerAddress].creditLines;
  }

  function setPoolAddress(address newPoolAddress) public onlyOwner returns (address) {
    return poolAddress = newPoolAddress;
  }

  function createCreditLine(address _borrower, uint _limit, uint _interestApr, uint _minCollateralPercent, uint _paymentPeriodInDays, uint _termInDays) external {
    Underwriter storage underwriter = underwriters[msg.sender];
    Borrower storage borrower = borrowers[_borrower];
    require(underwriterCanCreateThisCreditLine(_limit, underwriter), "The underwriter cannot create this credit line");

    CreditLine cl = new CreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays, _termInDays);
    cl.authorizePool(poolAddress);

    underwriter.creditLines.push(address(cl));
    borrower.creditLines.push(address(cl));
	}

  function drawdown(uint amount, address creditLineAddress) external {
    CreditLine cl = CreditLine(creditLineAddress);
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    require(amountWithinLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");

    if (cl.balance() == 0) {
      cl.setTermEndBlock(calculateNewTermEndBlock(cl));
      cl.setNextDueBlock(calculateNextDueBlock(cl));
    }
    (uint interestOwed, uint principalOwed) = getInterestAndPrincipalOwedAsOf(cl, block.number);
    uint balance = cl.balance().add(amount);

    updateCreditLineAccounting(cl, balance, interestOwed, principalOwed);
    getPool().transferFrom(poolAddress, msg.sender, amount);
  }

  function prepay(address payable creditLineAddress, uint amount) external payable {
    CreditLine cl = CreditLine(creditLineAddress);

    getPool().transferFrom(msg.sender, creditLineAddress, amount);
    uint newPrepaymentBalance = cl.prepaymentBalance().add(amount);
    cl.setPrepaymentBalance(newPrepaymentBalance);
  }

  function addCollateral(address payable creditLineAddress, uint amount) external payable {
    CreditLine cl = CreditLine(creditLineAddress);

    getPool().transferFrom(msg.sender, creditLineAddress, amount);
    uint newCollateralBalance = cl.collateralBalance().add(amount);
    cl.setCollateralBalance(newCollateralBalance);
  }

  function assessCreditLine(address creditLineAddress) external {
    CreditLine cl = CreditLine(creditLineAddress);
    // Do not assess until a full period has elapsed
    if (block.number < cl.nextDueBlock()) {
      return;
    }

    (uint paymentRemaining, uint interestPayment, uint principalPayment) = handlePayment(cl, cl.prepaymentBalance(), cl.nextDueBlock(), false);

    cl.setPrepaymentBalance(paymentRemaining);
    getPool().collectInterestRepayment(msg.sender, interestPayment);
    getPool().collectPrincipalRepayment(msg.sender, principalPayment);
    cl.setNextDueBlock(calculateNextDueBlock(cl));
    if (cl.principalOwed() > 0) {
      handleLatePayments(cl);
    }
  }

  function pay(address creditLineAddress, uint amount) external payable {
    CreditLine cl = CreditLine(creditLineAddress);

    // Not strictly necessary, but provides a better error message to the user
    if (!getPool().enoughBalance(msg.sender, amount)) {
      revert("Insufficient balance for payment");
    }

    (uint paymentRemaining, uint interestPayment, uint principalPayment) = handlePayment(cl, amount, block.number, true);
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
  }

  /*
   * Internal Functions
  */

  function handlePayment(CreditLine cl, uint paymentAmount, uint asOfBlock, bool allowFullBalancePayOff) internal returns (uint, uint, uint) {
    (uint interestOwed, uint principalOwed) = getInterestAndPrincipalOwedAsOf(cl, asOfBlock);
    PaymentAllocation memory pa = allocatePayment(paymentAmount, cl.balance(), interestOwed, principalOwed);

    uint newBalance = cl.balance().sub(pa.principalPayment);
    if (allowFullBalancePayOff) {
      newBalance = newBalance.sub(pa.additionalBalancePayment);
    }
    uint totalPrincipalPayment = cl.balance().sub(newBalance);
    uint paymentRemaining = paymentAmount.sub(pa.interestPayment).sub(totalPrincipalPayment);

    updateCreditLineAccounting(cl, newBalance, interestOwed.sub(pa.interestPayment), principalOwed.sub(pa.principalPayment));

    require(paymentRemaining.add(pa.interestPayment).add(totalPrincipalPayment) == paymentAmount, "Calculations must be wrong. Sum of amounts returned do not equal paymentAmount");

    return (paymentRemaining, pa.interestPayment, totalPrincipalPayment);
  }

  function handleLatePayments(CreditLine cl) internal {
    // No op for now;
  }

  function getPool() internal view returns (Pool) {
    return Pool(poolAddress);
  }

  function getInterestAndPrincipalOwedAsOf(CreditLine cl, uint blockNumber) internal view returns (uint, uint) {
    (uint interestAccrued, uint principalAccrued) = calculateInterestAndPrincipalAccrued(cl, blockNumber);
    return (cl.interestOwed().add(interestAccrued), cl.principalOwed().add(principalAccrued));
  }

  function calculateInterestAndPrincipalAccrued(CreditLine cl, uint blockNumber) internal view returns(uint, uint) {
    uint totalPayment = calculateAnnuityPayment(cl.balance(), cl.interestApr(), cl.termInDays(), cl.paymentPeriodInDays());
    uint interestAccrued = calculateInterestAccrued(cl, blockNumber);
    uint principalAccrued = calculatePrincipalAccrued(cl, totalPayment, interestAccrued, blockNumber);
    return (interestAccrued, principalAccrued);
  }

  function calculatePrincipalAccrued(CreditLine cl, uint periodPayment, uint interestAccrued, uint blockNumber) internal view returns(uint) {
    uint blocksPerPaymentPeriod = blocksPerDay * cl.paymentPeriodInDays();
    // Math.min guards against overflow. See comment in the calculateInterestAccrued for further explanation.
    uint lastUpdatedBlock = Math.min(blockNumber, cl.lastUpdatedBlock());
    uint numBlocksElapsed = blockNumber.sub(lastUpdatedBlock);
    int128 fractionOfPeriod = FPMath.divi(int256(numBlocksElapsed), int256(blocksPerPaymentPeriod));
    uint periodPaymentFraction = uint(FPMath.muli(fractionOfPeriod, int256(periodPayment)));
    return periodPaymentFraction.sub(interestAccrued);
  }

  function calculateInterestAccrued(CreditLine cl, uint blockNumber) internal view returns(uint) {
    // We use Math.min here to prevent integer overflow (ie. go negative) when calculating
    // numBlocksElapsed. Typically this shouldn't be possible, because
    // the lastUpdatedBlock couldn't be *after* the current blockNumber. However, when assessing
    // we allow this function to be called with a past block number, which raises the possibility
    // of overflow.
    // This use of min should not generate incorrect interest calculations, since
    // this functions purpose is just to normalize balances, and  will be called any time
    // a balance affecting action takes place (eg. drawdown, repayment, assessment)
    uint lastUpdatedBlock = Math.min(blockNumber, cl.lastUpdatedBlock());

    uint numBlocksElapsed = blockNumber.sub(lastUpdatedBlock);
    uint totalInterestPerYear = (cl.balance().mul(cl.interestApr())).div(interestDecimals);
    return totalInterestPerYear.mul(numBlocksElapsed).div(blocksPerYear);
  }

  function calculateAnnuityPayment(uint balance, uint interestApr, uint termInDays, uint paymentPeriodInDays) internal pure returns(uint) {
    /*
    This is the standard amortization formula for an annuity payment amount.
    See: https://en.wikipedia.org/wiki/Amortization_calculator

    The specific formula we're interested in can be expressed as:
    `balance * (periodRate / (1 - (1 / ((1 + periodRate) ^ periods_per_term))))`

    FPMath is a library designed for emulating floating point numbers in solidity.
    At a high level, we are just turning all our uint256 numbers into floating points and
    doing the formula above, and then turning it back into an int64 at the end.
    */


    // Components used in the formula
    uint periodsPerTerm = termInDays / paymentPeriodInDays;
    int128 one = FPMath.fromInt(int256(1));
    int128 annualRate = FPMath.divi(int256(interestApr), int256(interestDecimals));
    int128 dailyRate = FPMath.div(annualRate, FPMath.fromInt(int256(365)));
    int128 periodRate = FPMath.mul(dailyRate, FPMath.fromInt(int256(paymentPeriodInDays)));
    int128 termRate = FPMath.pow(FPMath.add(one, periodRate), periodsPerTerm);

    int128 denominator = FPMath.sub(one, FPMath.div(one, termRate));
    if (denominator == 0) {
      return balance / periodsPerTerm;
    }
    int128 paymentFractionFP = FPMath.div(periodRate, denominator);
    uint paymentFraction = uint(FPMath.muli(paymentFractionFP, int256(1e18)));

    return (balance * paymentFraction) / 1e18;
  }

  function updateCreditLineAccounting(CreditLine cl, uint balance, uint interestOwed, uint principalOwed) internal {
    cl.setBalance(balance);
    cl.setInterestOwed(interestOwed);
    cl.setPrincipalOwed(principalOwed);
    cl.setLastUpdatedBlock(block.number);

    if (balance == 0) {
      cl.setTermEndBlock(0);
    }
  }

  function amountWithinLimit(uint amount, CreditLine cl) internal view returns(bool) {
    return cl.balance().add(amount) <= cl.limit();
  }

  function allocatePayment(uint paymentAmount, uint balance, uint interestOwed, uint principalOwed) internal pure returns(PaymentAllocation memory) {
    uint paymentRemaining = paymentAmount;
    uint interestPayment = Math.min(interestOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(interestPayment);

    uint principalPayment = Math.min(principalOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(principalPayment);

    uint balanceRemaining = balance.sub(principalPayment);
    uint additionalBalancePayment = Math.min(paymentRemaining, balanceRemaining);

    return PaymentAllocation({
      interestPayment: interestPayment,
      principalPayment: principalPayment,
      additionalBalancePayment: additionalBalancePayment
    });
  }

  function calculateNewTermEndBlock(CreditLine cl) internal view returns (uint) {
    return block.number.add(blocksPerDay.mul(cl.termInDays()));
  }

  function calculateNextDueBlock(CreditLine cl) internal view returns (uint) {
    uint blocksPerPeriod = cl.paymentPeriodInDays().mul(blocksPerDay);
    uint currentNextDueBlock;
    if (cl.nextDueBlock() != 0) {
      currentNextDueBlock = cl.nextDueBlock();
    } else {
      currentNextDueBlock = block.number;
    }
    return currentNextDueBlock.add(blocksPerPeriod);
  }

  function underwriterCanCreateThisCreditLine(uint newAmount, Underwriter storage underwriter) internal view returns(bool) {
    uint creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    uint totalToBeExtended = creditCurrentlyExtended.add(newAmount);
    return totalToBeExtended <= underwriter.governanceLimit;
  }

  function getCreditCurrentlyExtended(Underwriter storage underwriter) internal view returns (uint) {
    uint creditExtended = 0;
    for (uint i = 0; i < underwriter.creditLines.length; i++) {
      CreditLine cl = CreditLine(underwriter.creditLines[i]);
      creditExtended = creditExtended.add(cl.limit());
    }
    return creditExtended;
  }
}
