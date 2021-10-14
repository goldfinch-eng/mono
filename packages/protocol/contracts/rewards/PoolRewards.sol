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

  struct PoolRewardsInfo {
    bool paused; // ability to pause each pool withdraws
    uint256 rewards;
  }

  struct PoolRewardsTokenInfo {
    uint256 rewardDebt; // amount of rewards claimed per PoolToken
  }

  uint256 public totalSupply; // total amount of GFI rewards available
  uint256 public maxAmountEligibleForRewards;
  uint256 public totalInterestReceived; // counter of on-time interest repayments across all jr pools

  uint256 private sqrtTotalSupply;
  uint256 private rewardRatio;

  mapping(uint256 => PoolRewardsTokenInfo) public tokens; // poolTokenId -> poolRewardsTokenInfo
  mapping(address => PoolRewardsInfo) public pools; // pool.address -> PoolRewardsInfo

  // TODO: define events
  event PoolRewardsAllocated();
  event PoolTokenRewardWithdraw();
  event PoolRewardsPaused();
  event PoolRewardsUnpaused();

  function initialize(
    address owner,
    uint256 _totalSupply,
    uint256 _maxAmountEligibleForRewards
  ) public initializer {
    totalSupply = _totalSupply;
    maxAmountEligibleForRewards = _maxAmountEligibleForRewards;
    _calcRewardRatio();
    __BaseUpgradeablePausable__init(owner);
  }

  function setMaxAmountEligibleForRewards(uint256 _maxAmountEligibleForRewards) public onlyAdmin {
    maxAmountEligibleForRewards = _maxAmountEligibleForRewards;
    _calcRewardRatio();
  }

  function setTotalSupply(uint256 _totalSupply) public onlyAdmin {
    totalSupply = _totalSupply;
    _calcRewardRatio();
  }

  // Allocates rewards to a given pool
  function allocateRewards(address _poolAddress, uint256 _interestPaymentAmount) public onlyAdmin {
    uint256 _totalInterestReceived = totalInterestReceived;

    require(_totalInterestReceived < maxAmountEligibleForRewards, "All rewards exhausted");

    uint256 rewards;
    uint256 sum = _totalInterestReceived + _interestPaymentAmount;
    uint256 _totalSupply = totalSupply;

    // increment the total interest recieved across all junior pools
    totalInterestReceived = sum;

    // if over threshold of totalSupply, only grant rewards to limit
    if (sum > _totalSupply) {
      rewards = _calcRewards(_totalSupply);
    } else {
      rewards = _calcRewards(_totalInterestReceived + _interestPaymentAmount);
    }

    PoolRewardsInfo storage _poolInfo = pools[_poolAddress];
    _poolInfo.rewards = _poolInfo.rewards + rewards;
    _poolInfo.paused = _poolInfo.paused || false;
    emit PoolRewardsAllocated();
  }

  // calculate PoolToken principal % of total JuniorTranche and subtract already withdrawn amount
  function _claimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);

    address poolAddr = tokenInfo.pool;
    require(poolAddr != address(0), "Invalid tokenId");

    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

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
    require(poolAddr != address(0), "Invalid tokenId");
    require(!pools[poolAddr].paused, "Pool withdraw paused");
    require(poolTokenRewardDebt + _amount <= totalClaimableRewards, "Rewards overwithdraw attempt");

    tokens[tokenId].rewardDebt = poolTokenRewardDebt + _amount;

    safeERC20TransferFrom(config.getGFI(), poolTokens.ownerOf(tokenId), address(this), _amount);
    emit PoolTokenRewardWithdraw();
  }

  /* Internal functions  */

  function _calcRewardRatio() internal {
    uint256 _totalSupply = totalSupply;
    rewardRatio = _totalSupply / maxAmountEligibleForRewards;
    sqrtTotalSupply = Babylonian.sqrt(_totalSupply);
  }

  // Calculate the total rewards between two intervals
  function _calcRewards(uint256 _endInterval) internal view returns (uint256) {
    return ((Babylonian.sqrt(totalInterestReceived) - Babylonian.sqrt(_endInterval)) / sqrtTotalSupply) * rewardRatio;
  }
}
