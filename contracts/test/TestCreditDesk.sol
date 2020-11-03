// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "../protocol/CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  function _setTotalLoansOutstanding(uint256 amount) public {
    totalLoansOutstanding = amount;
  }
}
