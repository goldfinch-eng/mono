// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/BaseUpgradeablePausable.sol";
import "../protocol/core/CreditLine.sol";

contract TestCreditLine is CreditLine {
  function setInterestApr(uint256 _interestApr) public onlyAdmin {
    interestApr = _interestApr;
  }

  function _getCheckpointedAsOf() external view returns (uint256) {
    return _checkpointedAsOf;
  }

  function setBalance(uint256 _balance) external {
    balance = _balance;
  }

  function setLateFeeApr(uint256 _lateFeeApr) external {
    lateFeeApr = _lateFeeApr;
  }

  function __checkpoint() external {
    super._checkpoint();
  }
}
