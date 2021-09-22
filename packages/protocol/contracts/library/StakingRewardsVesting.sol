// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

library StakingRewardsVesting {
  using SafeMath for uint256;
  using StakingRewardsVesting for Rewards;

  uint256 internal constant PERCENTAGE_DECIMALS = 1e18;

  struct Rewards {
    uint256 totalUnvested;
    uint256 totalVested;
    uint256 totalPreviouslyVested;
    uint256 totalClaimed;
    uint256 startTime;
    uint256 endTime;
  }

  function claim(Rewards storage rewards, uint256 reward) internal {
    rewards.totalClaimed = rewards.totalClaimed.add(reward);
  }

  function claimable(Rewards storage rewards) internal view returns (uint256) {
    return rewards.totalVested.add(rewards.totalPreviouslyVested).sub(rewards.totalClaimed);
  }

  function currentGrant(Rewards storage rewards) internal view returns (uint256) {
    return rewards.totalUnvested.add(rewards.totalVested);
  }

  /// @notice Slash the vesting rewards by `percentage`. `percentage` of the unvested portion
  ///   of the grant is forfeited. The remaining unvested portion continues to vest over the rest
  ///   of the vesting schedule. The already vested portion continues to be claimable.
  ///
  ///   A motivating example:
  ///
  ///   Let's say we're 50% through vesting, with 100 tokens granted. Thus, 50 tokens are vested and 50 are unvested.
  ///   Now let's say the grant is slashed by 90% (e.g. for StakingRewards, because the user unstaked 90% of their
  ///   position). 45 of the unvested tokens will be forfeited. 5 of the unvested tokens and 5 of the vested tokens
  ///   will be considered as the "new grant", which is 50% through vesting. The remaining 45 vested tokens will be
  ///   still be claimable at any time.
  function slash(Rewards storage rewards, uint256 percentage) internal {
    require(percentage <= PERCENTAGE_DECIMALS, "slashing percentage cannot be greater than 100%");

    uint256 unvestedToSlash = rewards.totalUnvested.mul(percentage).div(PERCENTAGE_DECIMALS);
    uint256 vestedToMove = rewards.totalVested.mul(percentage).div(PERCENTAGE_DECIMALS);

    rewards.totalUnvested = rewards.totalUnvested.sub(unvestedToSlash);
    rewards.totalVested = rewards.totalVested.sub(vestedToMove);
    rewards.totalPreviouslyVested = rewards.totalPreviouslyVested.add(vestedToMove);
  }

  function checkpoint(Rewards storage rewards) internal {
    uint256 newTotalVested = totalVestedAt(rewards.startTime, rewards.endTime, block.timestamp, rewards.currentGrant());

    if (newTotalVested > rewards.totalVested) {
      uint256 difference = newTotalVested.sub(rewards.totalVested);
      rewards.totalUnvested = rewards.totalUnvested.sub(difference);
      rewards.totalVested = newTotalVested;
    }
  }

  function totalVestedAt(
    uint256 start,
    uint256 end,
    uint256 time,
    uint256 grantedAmount
  ) internal pure returns (uint256) {
    if (end <= start) {
      return grantedAmount;
    }

    return Math.min(grantedAmount.mul(time.sub(start)).div(end.sub(start)), grantedAmount);
  }
}
