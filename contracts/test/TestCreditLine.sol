// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/Pool.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../protocol/core/CreditLine.sol";

contract TestCreditLine is CreditLine {
  uint256 private _timestampForTest;

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
