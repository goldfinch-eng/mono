// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  uint256 _timestampForTest;

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _setTotalLoansOutstanding(uint256 amount) public {
    totalLoansOutstanding = amount;
  }

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _setTimestampForTest(uint256 timestamp) public {
    _timestampForTest = timestamp;
  }

  function currentTime() internal view override returns (uint256) {
    if (_timestampForTest == 0) {
      return super.currentTime();
    } else {
      return _timestampForTest;
    }
  }

  // currentTime in internal
  function currentTimestamp() public view returns (uint256) {
    return currentTime();
  }
}
