// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/StakingRewards.sol";

contract TestStakingRewards is StakingRewards {
  function getBaseTokenExchangeRate(StakedPositionType positionType) public view override returns (uint256) {
    if (positionType == StakedPositionType.CurveLP) {
      return 1;
    } else if (positionType == StakedPositionType.Fidu) {
      return 1;
    } else {
      revert("unsupported StakedPositionType");
    }
  }
}
