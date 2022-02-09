// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IStakingRewards {
  function ownerOf(uint256 tokenId) external view returns (address);

  function unstake(uint256 tokenId, uint256 amount) external;
}
