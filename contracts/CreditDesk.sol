// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@nomiclabs/buidler/console.sol";
import "./Pool.sol";
import "./CreditLine.sol";
import "./FPMath.sol";

contract CreditDesk is Ownable {
  // Approximate number of blocks
  uint public constant blocksPerDay = 5760;
  uint public constant blocksPerYear = (blocksPerDay * 365);
  uint public constant interestDecimals = 1e18;
  address public poolAddress;

  struct Underwriter {
    uint governanceLimit;
    address[] creditLines;
  }

  struct PaymentAllocation {
    uint interestPaidOff;
    uint principalPaidOff;
    uint additionalBalancePaidOff;
    uint paymentRemaining;
    uint balanceRemaining;
  }

  mapping(address => Underwriter) public underwriters;

  function setUnderwriterGovernanceLimit(address underwriterAddress, uint limit) external onlyOwner {
    Underwriter storage underwriter = underwriters[underwriterAddress];
    underwriter.governanceLimit = limit;
  }

  function getUnderwriterCreditLines(address underwriterAddress) public view returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }

  function setPoolAddress(address newPoolAddress) public onlyOwner returns (address) {
    return poolAddress = newPoolAddress;
  }

  function createCreditLine(
    address _borrower,
    uint _limit,
    uint _interestApr,
    uint _minCollateralPercent,
    uint _paymentPeriodInDays,
    uint _termInDays
  ) external {
    Underwriter storage underwriter = underwriters[msg.sender];
    require(underwriterCanCreateThisCreditLine(_limit, underwriter), "The underwriter cannot create this credit line");

    CreditLine cl = new CreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays, _termInDays);
    underwriter.creditLines.push(address(cl));
	}

  function drawdown(uint amount, address creditLineAddress) external {
    CreditLine cl = CreditLine(creditLineAddress);
    require(cl.borrower() == msg.sender, "You do not belong to this credit line");
    require(amountWithinLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");

    if (cl.balance() == 0) {
      uint newTermEndBlock = block.number + (blocksPerDay * cl.termInDays());
      cl.setTermEndBlock(newTermEndBlock);
    }
    (uint interestAccrued, uint principalAccrued) = calculateInterestAndPrincipalAccrued(cl);
    cl.setBalance(cl.balance() + amount);
    cl.setInterestOwed(cl.interestOwed() + interestAccrued);
    cl.setPrincipalOwed(cl.principalOwed() + principalAccrued);
    cl.setLastUpdatedBlock(block.number);

    Pool(poolAddress).transferFunds(msg.sender, amount);
  }

  function prepayment(address payable creditLineAddress) external payable {
    CreditLine cl = CreditLine(creditLineAddress);
    cl.receivePrepayment{value: msg.value}();
  }

  function addCollateral(address payable creditLineAddress) external payable {
    CreditLine cl = CreditLine(creditLineAddress);
    cl.receiveCollateral{value: msg.value}();
  }

  function payment(address creditLineAddress) external payable {
    CreditLine cl = CreditLine(creditLineAddress);
    (uint interestAccrued, uint principalAccrued) = calculateInterestAndPrincipalAccrued(cl);
    uint totalInterestOwed = cl.interestOwed() + interestAccrued;
    uint totalPrincipalOwed = cl.principalOwed() + principalAccrued;

    PaymentAllocation memory pa = allocatePayment(msg.value, cl.balance(), totalInterestOwed, totalPrincipalOwed);

    sendPaymentToPool(pa);
    updateCreditLineAfterRepayment(cl, totalInterestOwed, totalPrincipalOwed, pa);

    if (pa.paymentRemaining > 0 && pa.paymentRemaining <= msg.value) {
      cl.receiveCollateral{value: pa.paymentRemaining}();
    }
  }

  function sendPaymentToPool(PaymentAllocation memory pa) public payable {
    require(pa.principalPaidOff + pa.interestPaidOff <= msg.value);
    Pool(poolAddress).receivePrincipalRepayment{value: pa.principalPaidOff}();
    Pool(poolAddress).receiveInterestRepayment{value: pa.interestPaidOff}();
  }


  /*
   * Internal Functions
  */

  function calculateInterestAndPrincipalAccrued(CreditLine cl) internal view returns(uint, uint) {
    uint totalPayment = calculateAnnuityPayment(cl.balance(), cl.interestApr(), cl.termInDays(), cl.paymentPeriodInDays());
    uint interestAccrued = calculateInterestAccrued(cl);
    uint principalAccrued = calculatePrincipalAccrued(cl, totalPayment, interestAccrued);
    return (interestAccrued, principalAccrued);
  }

  function calculatePrincipalAccrued(CreditLine cl, uint periodPayment, uint interestAccrued) internal view returns(uint) {
    uint blocksPerPaymentPeriod = blocksPerDay * cl.paymentPeriodInDays();
    uint numBlocksElapsed = block.number - cl.lastUpdatedBlock();
    int128 fractionOfPeriod = FPMath.divi(int256(numBlocksElapsed), int256(blocksPerPaymentPeriod));
    uint periodPaymentFraction = uint(FPMath.muli(fractionOfPeriod, int256(periodPayment)));
    return periodPaymentFraction - interestAccrued;
  }

  function calculateInterestAccrued(CreditLine cl) internal view returns(uint) {
    uint numBlocksElapsed = block.number - cl.lastUpdatedBlock();
    uint totalInterestPerYear = (cl.balance() * cl.interestApr()) / interestDecimals;
    return totalInterestPerYear * numBlocksElapsed / blocksPerYear;
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

  function updateCreditLineAfterRepayment(CreditLine cl, uint totalInterestOwed, uint totalPrincipalOwed, PaymentAllocation memory pa) internal {
    cl.setBalance(pa.balanceRemaining);
    cl.setInterestOwed(totalInterestOwed - pa.interestPaidOff);
    cl.setPrincipalOwed(totalPrincipalOwed - pa.principalPaidOff);
    cl.setLastUpdatedBlock(block.number);
  }

  function amountWithinLimit(uint amount, CreditLine cl) internal view returns(bool) {
    // TODO: This should take into account collateral and min collateral percent
    return cl.balance() + amount <= cl.limit();
  }

  function allocatePayment(uint paymentAmount, uint balanceRemaining, uint totalInterestAccrued, uint totalPrincipalAccrued) internal pure returns(PaymentAllocation memory) {
    uint paymentRemaining = paymentAmount;
    uint interestPaidOff = Math.min(totalInterestAccrued, paymentRemaining);
    paymentRemaining = paymentRemaining - interestPaidOff;

    uint principalPaidOff = Math.min(totalPrincipalAccrued, paymentRemaining);
    paymentRemaining = paymentRemaining - principalPaidOff;
    balanceRemaining = balanceRemaining - principalPaidOff;

    uint additionalBalancePaidOff = Math.min(balanceRemaining, paymentRemaining);
    paymentRemaining = paymentRemaining - additionalBalancePaidOff;
    balanceRemaining = balanceRemaining - additionalBalancePaidOff;

    return PaymentAllocation({
      interestPaidOff: interestPaidOff,
      principalPaidOff: principalPaidOff,
      additionalBalancePaidOff: additionalBalancePaidOff,
      paymentRemaining: paymentRemaining,
      balanceRemaining: balanceRemaining
    });
  }

  function underwriterCanCreateThisCreditLine(uint newAmount, Underwriter storage underwriter) internal view returns(bool) {
    uint creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    uint totalToBeExtended = creditCurrentlyExtended + newAmount;
    return totalToBeExtended <= underwriter.governanceLimit;
  }

  function getCreditCurrentlyExtended(Underwriter storage underwriter) internal view returns (uint) {
    uint creditExtended = 0;
    for (uint i = 0; i < underwriter.creditLines.length; i++) {
      CreditLine cl = CreditLine(underwriter.creditLines[i]);
      creditExtended += cl.limit();
    }
    return creditExtended;
  }
}