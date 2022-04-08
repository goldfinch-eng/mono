// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/StakingRewards.sol";

contract TestStakingRewards is StakingRewards {
  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  mapping(StakedPositionType => uint256) private exchangeRates;

  /// @dev Used in unit tests to mock the effective multiplier for a given position
  function setPositionEffectiveMultiplier(uint256 tokenId, uint256 newMultiplier) external {
    StakedPosition storage position = positions[tokenId];

    position.unsafeEffectiveMultiplier = newMultiplier;
  }

  function getBaseTokenExchangeRate(StakedPositionType positionType) public view override returns (uint256) {
    uint256 exchangeRate = exchangeRates[positionType];

    if (exchangeRate > 0) {
      return exchangeRate;
    }

    if (positionType == StakedPositionType.CurveLP) {
      return MULTIPLIER_DECIMALS; // 1x
    } else if (positionType == StakedPositionType.Fidu) {
      return MULTIPLIER_DECIMALS; // 1x
    } else {
      revert("unsupported StakedPositionType");
    }
  }

  /// @dev Used in unit tests to set the base token exchange rate
  function _setBaseTokenExchangeRate(StakedPositionType positionType, uint256 exchangeRate) public returns (uint256) {
    exchangeRates[positionType] = exchangeRate;
  }
}
