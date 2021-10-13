// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@uniswap/lib/contracts/libraries/Babylonian.sol";

import "../library/SafeERC20Transfer.sol";
import "../protocol/core/ConfigHelper.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../interfaces/IPoolTokens.sol";
import "../interfaces/ITranchedPool.sol";

contract PoolRewards is BaseUpgradeablePausable, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  struct PoolInfo {
    bool paused; // ability to pause each pool withdraws
    uint256 rewards;
  }

  struct PoolTokenInfo {
    uint256 rewardDebt; // amount of rewards claimed
  }

  uint256 public maxRewardsAvailable;
  uint256 public maxAmountEligibleForRewards;
  uint256 public totalInterestReceived; // counter of on-time interest repayments across all jr pools

  uint256 private sqrtMaxRewardsAvailable;
  uint256 private rewardRatio;

  mapping(uint256 => PoolTokenInfo) public tokens; // poolTokenId -> poolTokenInfo
  mapping(address => PoolInfo) public pools; // pool.address -> PoolInfo

  // TODO: define events
  event RewardGrant();
  event RewardWithdraw();
  event PoolRewardsPaused();
  event PoolRewardsUnpaused();

  function initialize(
    address owner,
    uint256 _maxRewardsAvailable,
    uint256 _maxAmountEligibleForRewards
  ) public initializer {
    require(owner != address(0), "Owner address cannot be empty");
    maxRewardsAvailable = _maxRewardsAvailable;
    maxAmountEligibleForRewards = _maxAmountEligibleForRewards;
    _calcRewardRatio();
    __BaseUpgradeablePausable__init(owner);
  }

  function setMaxAmountEligibleForRewards(uint256 _maxAmountEligibleForRewards) public onlyAdmin {
    maxAmountEligibleForRewards = _maxAmountEligibleForRewards;
    _calcRewardRatio();
  }

  function setMaxRewardsAvailable(uint256 _maxRewardsAvailable) public onlyAdmin {
    maxRewardsAvailable = _maxRewardsAvailable;
    _calcRewardRatio();
  }

  // Allocates rewards to a given pool
  function grant(address _poolAddress, uint256 _interestPaymentAmount) public onlyAdmin {
    // TODO: should we make grant() pausable?

    uint256 _totalInterestReceived = totalInterestReceived;

    // All reward grants exhausted :(
    if (_totalInterestReceived >= maxAmountEligibleForRewards) {
      return;
    }

    uint256 rewards;
    uint256 sum = _totalInterestReceived + _interestPaymentAmount;
    uint256 _maxRewardsAvailable = maxRewardsAvailable;

    // increment the total interest recieved across all junior pools
    totalInterestReceived = sum;

    // if over threshold of maxRewardsAvailable, only grant rewards to limit
    if (sum > _maxRewardsAvailable) {
      rewards = _calcRewards(_maxRewardsAvailable);
    } else {
      rewards = _calcRewards(_totalInterestReceived + _interestPaymentAmount);
    }

    PoolInfo storage _poolInfo = pools[_poolAddress];
    _poolInfo.rewards = _poolInfo.rewards + rewards;
    _poolInfo.paused = _poolInfo.paused || false;
    emit RewardGrant();
  }

  // calculate PoolToken principal % of total JuniorTranche and subtract already withdrawn amount
  function _claimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);

    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    address poolAddr = tokenInfo.pool;
    require(tokenInfo.pool != address(0), "Invalid tokenId");

    return
      (tokenInfo.principalAmount / juniorTranche.principalDeposited) *
      (pools[poolAddr].rewards - tokens[tokenId].rewardDebt);
  }

  function pausePoolWithdraws(address _poolAddress) public onlyAdmin {
    pools[_poolAddress].paused = true;
    emit PoolRewardsPaused();
  }

  function unpausePoolWithdraws(address _poolAddress) public onlyAdmin {
    pools[_poolAddress].paused = false;
    emit PoolRewardsUnpaused();
  }

  function withdraw(uint256 tokenId, uint256 _amount) public onlyAdmin {
    uint256 totalClaimableRewards = _claimableRewards(tokenId);
    uint256 poolTokenRewardDebt = tokens[tokenId].rewardDebt;

    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    address poolAddr = tokenInfo.pool;

    require(!pools[poolAddr].paused, "Pool withdraw paused");
    require(poolTokenRewardDebt + _amount <= totalClaimableRewards, "Rewards overwithdraw attempt");

    tokens[tokenId].rewardDebt = poolTokenRewardDebt + _amount;

    // tokenId = config.getPoolTokens().mint(params, msg.sender);
    // safeERC20TransferFrom(config.getUSDC(), msg.sender, address(this), amount);
    // emit RewardWithdraw(msg.sender, tranche, tokenId, amount);
    // return tokenId;
  }

  /* Internal functions  */

  function _calcRewardRatio() internal {
    uint256 _maxRewardsAvailable = maxRewardsAvailable;
    rewardRatio = _maxRewardsAvailable / maxAmountEligibleForRewards;
    sqrtMaxRewardsAvailable = Babylonian.sqrt(_maxRewardsAvailable);
  }

  // Calculate the total rewards between two intervals
  function _calcRewards(uint256 _endInterval) internal view returns (uint256) {
    return
      ((Babylonian.sqrt(totalInterestReceived) - Babylonian.sqrt(_endInterval)) / sqrtMaxRewardsAvailable) *
      rewardRatio;
  }
}
