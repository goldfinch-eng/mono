// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../protocol/Accountant.sol";
import "../protocol/CreditLine.sol";

contract TestAccountant {
  function calculateInterestAndPrincipalAccrued(
    address creditLineAddress,
    uint256 blockNumber,
    uint256 lateFeeGracePeriod
  ) public view returns (uint256, uint256) {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateInterestAndPrincipalAccrued(cl, blockNumber, lateFeeGracePeriod);
  }

  function calculateWritedownFor(
    address creditLineAddress,
    uint256 blockNumber,
    uint256 gracePeriod,
    uint256 maxLatePeriods
  ) public view returns (uint256, uint256) {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateWritedownFor(cl, blockNumber, gracePeriod, maxLatePeriods);
  }

  function calculateAmountOwedForOnePeriod(address creditLineAddress) public view returns (uint256) {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateAmountOwedForOnePeriod(cl);
  }
}
