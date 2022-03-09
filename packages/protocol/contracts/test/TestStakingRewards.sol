// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/StakingRewards.sol";

contract TestStakingRewards is StakingRewards {
  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  mapping(StakedPositionType => uint256) private exchangeRates;

  /// @notice "Kick" a user's reward multiplier. If they are past their lock-up period, their reward
  ///   multipler will be reset to 1x.
  /// @dev This will also checkpoint their rewards up to the current time.
  // solhint-disable-next-line no-empty-blocks
  function kick(uint256 tokenId) external nonReentrant whenNotPaused updateReward(tokenId) {}

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

  function _setBaseTokenExchangeRate(StakedPositionType positionType, uint256 exchangeRate) public returns (uint256) {
    exchangeRates[positionType] = exchangeRate;
  }
}
