// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
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

    uint blockNumber = block.number;
    if (cl.balance() == 0) {
      uint newTermEndBlock = blockNumber + (blocksPerDay * cl.termInDays());
      cl.setTermEndBlock(newTermEndBlock);
    }
    (uint interestAccrued, uint principalAccrued) = calculateInterestAndPrincipalAccrued(cl, blockNumber);
    cl.setBalance(cl.balance() + amount);
    cl.setInterestOwed(cl.interestOwed() + interestAccrued);
    cl.setPrincipalOwed(cl.principalOwed() + principalAccrued);
    cl.setLastUpdatedBlock(blockNumber);

    Pool(poolAddress).transferFunds(msg.sender, amount);
  }

  function calculateInterestAccrued(CreditLine cl, uint blockNumber) internal view returns(uint) {
    uint numBlocksElapsed = blockNumber - cl.lastUpdatedBlock();
    uint totalInterestPerYear = (cl.balance() * cl.interestApr()) / interestDecimals;
    return totalInterestPerYear * numBlocksElapsed / blocksPerYear;
  }

  function calculateInterestAndPrincipalAccrued(CreditLine cl, uint blockNumber) internal view returns(uint, uint) {
    uint totalPayment = calculateAnnuityPayment(cl.balance(), cl.interestApr(), cl.termInDays(), cl.paymentPeriodInDays());
    uint interestAccrued = calculateInterestAccrued(cl, blockNumber);
    uint principalAccrued = totalPayment - interestAccrued;
    return (interestAccrued, principalAccrued);
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

  // function calculatePrincipalAccrued(CreditLine cl) internal returns(uint) {
  //   return 0;
  // }

  function prepayment(uint amount) external {
    // TODO: Implement me!
  }

  function payment() external {
    // TODO: Implement me!
  }

  // Internal Functions
  function amountWithinLimit(uint amount, CreditLine cl) internal view returns(bool) {
    // TODO: This should take into account collateral and min collateral percent
    return cl.balance() + amount <= cl.limit();
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