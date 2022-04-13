// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/StakingRewards.sol";

contract TestStakingRewards is StakingRewards {
  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  mapping(StakedPositionType => uint256) private exchangeRates;

  /// @dev Used in unit tests to mock the `unsafeEffectiveMultiplier` for a given position
  function _setPositionUnsafeEffectiveMultiplier(uint256 tokenId, uint256 newMultiplier) external {
    StakedPosition storage position = positions[tokenId];

    position.unsafeEffectiveMultiplier = newMultiplier;
  }
}
