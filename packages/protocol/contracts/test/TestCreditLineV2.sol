// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {CreditLineV2} from "../protocol/core/CreditLineV2.sol";

contract TestCreditLineV2 is CreditLineV2 {
  function _getCheckpointedAsOf() external view returns (uint256) {
    return _checkpointedAsOf;
  }

  function _checkpoint() external {
    super.checkpoint();
  }
}
