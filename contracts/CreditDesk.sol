// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GoldfinchPool.sol";
import "./CreditLine.sol";

contract CreditDesk is Ownable {
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
    uint creditCurrentlyExtended = getCreditCurrentlyExtended(underwriter);
    creditCurrentlyExtended += _limit;

    require(creditCurrentlyExtended < underwriter.governanceLimit, "The underwriter cannot create this credit line");

    CreditLine cl = new CreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays, _termInDays);

    underwriter.creditLines.push(address(cl));
	}

  // function underwriterCanCreateThisCreditLine(uint newAmount, Underwriter storage underwriter) internal view returns(bool) {
  // }

  function getCreditCurrentlyExtended(Underwriter storage underwriter) internal view returns (uint) {
    uint creditExtended = 0;
    for (uint i = 0; i < underwriter.creditLines.length; i++) {
      CreditLine cl = CreditLine(underwriter.creditLines[i]);
      creditExtended += cl.limit();
    }
    return creditExtended;
  }
}