// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IStakingRewards {
  function kick(uint256 tokenId) external;

  function accumulatedRewardsPerToken() external view returns (uint256);

  function lastUpdateTime() external view returns (uint256);
}
