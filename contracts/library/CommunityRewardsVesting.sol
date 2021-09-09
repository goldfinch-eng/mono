// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

library CommunityRewardsVesting {
  using SafeMath for uint256;
  using CommunityRewardsVesting for Rewards;

  struct Rewards {
    uint256 totalGranted;
    uint256 totalClaimed;
    uint256 startTime;
    uint256 endTime;
    uint256 cliffLength;
    uint256 vestingInterval;
    uint256 revokedAt;
  }

  function claim(Rewards storage rewards, uint256 reward) internal {
    rewards.totalClaimed = rewards.totalClaimed.add(reward);
  }

  function claimable(Rewards storage rewards) internal view returns (uint256) {
    return claimable(rewards, block.timestamp);
  }

  function claimable(Rewards storage rewards, uint256 time) internal view returns (uint256) {
    return rewards.totalVestedAt(time).sub(rewards.totalClaimed);
  }

  function totalUnvestedAt(Rewards storage rewards, uint256 time) internal view returns (uint256) {
    return rewards.totalGranted.sub(rewards.totalVestedAt(time));
  }

  function totalVestedAt(Rewards storage rewards, uint256 time) internal view returns (uint256) {
    uint256 start = rewards.startTime;
    uint256 end = rewards.endTime;
    uint256 granted = rewards.totalGranted;

    if (time < start.add(rewards.cliffLength)) {
      return 0;
    }

    if (end <= start) {
      return granted;
    }

    uint256 elapsedVestingTimestamp = revokedAt > 0 ? Math.min(revokedAt, time) : time;
    uint256 elapsedVestingUnits = (elapsedVestingTimestamp.sub(start)).div(vestingInterval);
    uint256 totalVestingUnits = (end.sub(start)).div(vestingInterval);
    return Math.min(granted.mul(elapsedVestingUnits).div(totalVestingUnits), granted);
  }
}
