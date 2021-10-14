// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";

import "../library/SafeERC20Transfer.sol";
import "../protocol/core/ConfigHelper.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../interfaces/IPoolTokens.sol";
import "../interfaces/ITranchedPool.sol";

// Basically, Every time a on-time interest payment comes back across any JrPool
// we keep a running total of dollars (totalInterestReceived) until it reaches the maxInterestDollarsEligible limit
// Every dollar of interest received from 0->maxInterestDollarsEligible
// has a allocated amount of rewards based on a sqrt function.

// When a on-time interest payment comes in for a given Pool or the pool balance increases
// we recalculate the pool's accRewardsPerShare

// equation ref `_calculateNewRewards()`:
// (sqrtNewTotalInterest - sqrtOrigTotalInterest) / sqrtTotalRewards * (totalRewards / totalGFISupply)

// When a PoolToken is minted, we set the mint price to the pool's current accRewardsPerShare
// Every time a PoolToken withdraws rewards, we determine the allocated rewards,  increase that PoolToken's rewardDebt,
// and transfer the owner the gfi

// equation to find a PoolToken's allocated rewards ref: `poolTokenClaimableRewards()`
// Token.principalAmount * (Pool.accRewardsPerShare - Token.accRewardsPerShareMintPrice) - Token.rewardDebt

contract PoolRewards is BaseUpgradeablePausable, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct PoolRewardsInfo {
    bool paused; // per-pool pause
    uint256 accRewardsPerShare; // accumulator gfi per interest dollar
  }

  struct PoolRewardsTokenInfo {
    uint256 rewardDebt; // gfi claimed
    uint256 accRewardsPerShareMintPrice; // Pool's accRewardsPerShare at PoolToken mint()
  }

  uint256 public totalRewards; // total amount of GFI rewards available
  uint256 public maxInterestDollarsEligible; // interest $ eligible for gfi rewards
  uint256 public totalInterestReceived; // counter of on-time interest repayments across all jr pools

  uint256 private sqrtTotalRewards; // sqrt(totalRewards)
  uint256 private totalRewardPercentOfTotalGFI; // totalRewards/totalGFISupply

  mapping(uint256 => PoolRewardsTokenInfo) public tokens; // poolTokenId -> PoolRewardsTokenInfo
  mapping(address => PoolRewardsInfo) public pools; // pool.address -> PoolRewardsInfo

  // TODO: define events
  event PoolRewardsAllocated();
  event PoolTokenRewardWithdraw();
  event PoolRewardsPaused();
  event PoolRewardsUnpaused();

  function initialize(
    address owner,
    uint256 _totalRewards,
    uint256 _maxInterestDollarsEligible
  ) public initializer {
    totalRewards = _totalRewards;
    sqrtTotalRewards = Babylonian.sqrt(_totalRewards);
    totalRewardPercentOfTotalGFI = _totalRewards.div(config.getGFI().totalSupply());
    maxInterestDollarsEligible = _maxInterestDollarsEligible;
    __BaseUpgradeablePausable__init(owner);
  }

  // re-updates all pools accRewardsPerShare
  // function massUpdatePools() public onlyAdmin {
  // loop through all juniortranches and calculate pool accRewardsPerShareMintPrice
  // sum all junior tranche interest payments and set totalInterestReceived
  // }

  // todo: do we need to recalculate all pools accRewardsPerShare if maxInterestDollarsEligible changes
  // function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public onlyAdmin {
  //   maxInterestDollarsEligible = _maxInterestDollarsEligible;
  // }

  // todo: do we need to recalculate all pools accRewardsPerShare if totalSupply changes
  // function setTotalSupply(uint256 _totalSupply) public onlyAdmin {
  //   totalSupply = _totalSupply;
  //   totalRewardPercentOfTotalGFI = _totalSupply.div(config.getGFI().totalSupply());
  //   sqrtTotalRewards = Babylonian.sqrt(_totalSupply);
  // }

  // When a new interest payment is received by a pool, recalculate accRewardsPerShare
  function allocateRewards(address _poolAddress, uint256 _interestPaymentAmount) public onlyAdmin {
    uint256 _totalInterestReceived = totalInterestReceived;

    require(_totalInterestReceived < maxInterestDollarsEligible, "All rewards exhausted");

    // Rewards earned between _totalInterestReceived & (_totalInterestReceived+_interestPaymentAmount)
    uint256 rewards = _calculateNewRewards(_interestPaymentAmount);

    ITranchedPool pool = ITranchedPool(_poolAddress);
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    PoolRewardsInfo storage _poolInfo = pools[_poolAddress];
    uint256 previousRewards = juniorTranche.interestSharePrice.mul(_poolInfo.accRewardsPerShare);
    _poolInfo.accRewardsPerShare = previousRewards.add(rewards).div(_totalInterestReceived);
    emit PoolRewardsAllocated();
  }

  // calculate the rewards allocated to a given PoolToken
  // PoolToken.principalAmount * (accRewardsPerShare-accRewardsPerShareMintPrice) - rewardDebt
  function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    return
      tokenInfo
        .principalAmount
        .mul(pools[tokenInfo.pool].accRewardsPerShare.sub(tokens[tokenId].accRewardsPerShareMintPrice))
        .sub(tokens[tokenId].rewardDebt);
  }

  // PoolToken request to withdraw currently allocated rewards
  function withdraw(uint256 tokenId, uint256 _amount) public onlyAdmin {
    uint256 totalClaimableRewards = poolTokenClaimableRewards(tokenId);
    uint256 poolTokenRewardDebt = tokens[tokenId].rewardDebt;

    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    address poolAddr = tokenInfo.pool;
    require(poolAddr != address(0), "Invalid tokenId");
    require(!pools[poolAddr].paused, "Pool withdraw paused");
    require(poolTokenRewardDebt.add(_amount) <= totalClaimableRewards, "Rewards overwithdraw attempt");

    tokens[tokenId].rewardDebt = poolTokenRewardDebt.add(_amount);

    safeERC20TransferFrom(config.getGFI(), poolTokens.ownerOf(tokenId), address(this), _amount);
    emit PoolTokenRewardWithdraw();
  }

  function pausePoolWithdraws(address _poolAddress) public onlyAdmin {
    pools[_poolAddress].paused = true;
    emit PoolRewardsPaused();
  }

  function unpausePoolWithdraws(address _poolAddress) public onlyAdmin {
    pools[_poolAddress].paused = false;
    emit PoolRewardsUnpaused();
  }

  /* Internal functions  */

  // Calculate the total rewards allocated to a pool
  // jrTranche.interestSharePrice * jrTranche.principalDeposited * pool.accRewardsPerShare
  function _getPoolTotalAllocatedRewards(uint256 tokenId) internal view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);

    require(tokenInfo.pool != address(0), "Invalid tokenId");

    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    return
      juniorTranche.interestSharePrice.mul(juniorTranche.principalDeposited).mul(
        pools[tokenInfo.pool].accRewardsPerShare
      );
  }

  // Calculate the rewards earned for a given interest payment
  // (sqrtNewTotalInterest - sqrtOrigTotalInterest) / sqrtTotalRewards * (totalRewards / totalGFISupply)
  function _calculateNewRewards(uint256 interestPaymentAmount) internal view returns (uint256) {
    uint256 _totalRewards = totalRewards;
    uint256 _originalTotalInterest = totalInterestReceived;
    uint256 newTotalInterest = _originalTotalInterest.add(interestPaymentAmount);

    // interest payment passed the cap, should only partially be rewarded
    if (newTotalInterest > _totalRewards) {
      newTotalInterest = _totalRewards.sub(_originalTotalInterest);
    }

    uint256 sqrtOrigTotalInterest = Babylonian.sqrt(_originalTotalInterest);
    uint256 sqrtNewTotalInterest = Babylonian.sqrt(newTotalInterest);

    return (sqrtNewTotalInterest.sub(sqrtOrigTotalInterest)).div(sqrtTotalRewards).mul(totalRewardPercentOfTotalGFI);
  }
}
