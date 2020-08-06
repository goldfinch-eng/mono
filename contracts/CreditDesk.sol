// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./GoldfinchPool.sol";
import "./CreditLine.sol";
import * as ABDKMath from "./ABDKMath.sol";

contract CreditDesk is Ownable {
  // Approximate number of blocks
  uint public constant blocksPerDay = 5760;
  uint public constant blocksPerYear = (blocksPerDay * 365);
  uint public constant interestDecimals = 1e18;

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
    require(amountWithinLimit(amount, cl), "The borrower does not have enough credit limit for this drawdown");
    uint blockNumber = block.number;
    // TODO: Require borrower is msg.sender;

    if (cl.balance() == 0) {
      uint newTermEndBlock = blockNumber + (blocksPerDay * cl.termInDays());
      cl.setTermEndBlock(newTermEndBlock);
    }
    // uint interestAccrued = calculateInterestAccrued(cl, blockNumber);
    // uint principalAccrued = calculatePrincipalAccrued(cl, blockNumber);
    (uint interestAccrued, uint principalAccrued) = calculateInterestAndPrincipalAccrued(cl, blockNumber);

    /* handle accounting
      2.) Update balance based on last updated at, interest rate, etc. This includes calculating interest and principal accrued since last time.
      3.) Update interest owed
      4.) Update principal owed
      5.) Update lastUpdatedAt
    */
    /* request transfer to sender
      GoldfinchPool.transfer_funds(amount, msg.sender);
    */
  }

  function calculateInterestAccrued(CreditLine cl, uint blockNumber) internal returns(uint) {
    uint numBlocksElapsed = blockNumber - cl.lastUpdatedBlock();
    uint totalInterestPerYear = (cl.balance() * cl.interestApr()) / interestDecimals;
    return totalInterestPerYear * numBlocksElapsed / blocksPerYear;
  }

  function calculateInterestAndPrincipalAccrued(CreditLine cl, uint blockNumber) internal returns(uint) {
    totalPayment = calculateTotalPayment()
    interestAccrued = calculateInterestAccrued()
    principalAccrued = totalPayment - interestApr
    return interestAccrued, principalAccrued
  }

  function calculateEvenPaymentPerPeriod(CreditLine cl) internal view returns (uint) {
    // Balance * interest per period / (1 - (1+interest_per_period) ^ (-periods_per_term))
    uint interestPerPeriod = cl.interestApr() / 365 * cl.paymentPeriodInDays();
    // cl.balance * interestPerPeriod / (1 - (1 + interestPerPeriod) ** )

    uint annualInterest = cl.balance * interestPerPeriod / interestDecimals;
    uint interestPerPayment = annualInterest / (1 - (1 + (interestPerPeriod ** periods_per_term / interestDecimals ** periods_per_term)))

    uint fp_interestPerPeriod = fromInt(interestPerPeriod)
    uint fp_interestDecimals = fromInt(interestDecimals)


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