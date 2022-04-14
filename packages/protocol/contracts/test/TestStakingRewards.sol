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

  function _getStakingAndRewardsTokenMantissa() public view returns (uint256) {
    return stakingAndRewardsTokenMantissa();
  }

  function _getFiduStakingTokenMantissa() public view returns (uint256) {
    return uint256(10)**IERC20withDec(address(stakingToken(StakedPositionType.Fidu))).decimals();
  }

  function _getCurveLPStakingTokenMantissa() public view returns (uint256) {
    return uint256(10)**IERC20withDec(address(stakingToken(StakedPositionType.CurveLP))).decimals();
  }

  function _getRewardsTokenMantissa() public view returns (uint256) {
    return uint256(10)**rewardsToken().decimals();
  }
}
