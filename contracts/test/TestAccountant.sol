// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../Accountant.sol";
import "../CreditLine.sol";

contract TestAccountant {
    function calculateInterestAndPrincipalAccrued(address creditLineAddress, uint blockNumber) public view returns (uint, uint) {
      CreditLine cl = CreditLine(creditLineAddress);
      return Accountant.calculateInterestAndPrincipalAccrued(cl, blockNumber);
    }
}
