// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  // solhint-disable-next-line modifiers/ensure-modifiers
  function _setTotalLoansOutstanding(uint256 amount) public {
    totalLoansOutstanding = amount;
  }
}
