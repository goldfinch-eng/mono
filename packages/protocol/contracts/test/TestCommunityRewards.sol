// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/CommunityRewards.sol";

contract TestCommunityRewards is CommunityRewards {
  function getGrant(uint256 tokenId) public view returns (CommunityRewardsVesting.Rewards memory) {
    return grants[tokenId];
  }

  function getClaimable(uint256 tokenId) public view returns (uint256) {
    return claimableRewards(tokenId);
  }
}
