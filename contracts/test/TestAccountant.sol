// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../protocol/Accountant.sol";
import "../protocol/CreditLine.sol";

contract TestAccountant {
  function calculateInterestAndPrincipalAccrued(address creditLineAddress, uint256 blockNumber)
    public
    view
    returns (uint256, uint256)
  {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateInterestAndPrincipalAccrued(cl, blockNumber);
  }
}
