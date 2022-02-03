// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/StakingRewards.sol";

contract TestStakingRewards is StakingRewards {
  mapping(StakedPositionType => uint256) private exchangeRates;

  function getBaseTokenExchangeRate(StakedPositionType positionType) public view override returns (uint256) {
    uint256 exchangeRate = exchangeRates[positionType];

    if (exchangeRate > 0) {
      return exchangeRate;
    }

    if (positionType == StakedPositionType.CurveLP) {
      return 1;
    } else if (positionType == StakedPositionType.Fidu) {
      return 1;
    } else {
      revert("unsupported StakedPositionType");
    }
  }

  function _setBaseTokenExchangeRate(StakedPositionType positionType, uint256 exchangeRate) public returns (uint256) {
    exchangeRates[positionType] = exchangeRate;
  }
}
