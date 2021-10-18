// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";

import "../library/SafeERC20Transfer.sol";
import "../protocol/core/ConfigHelper.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../interfaces/IPoolTokens.sol";
import "../interfaces/ITranchedPool.sol";
import "../interfaces/IPoolRewards.sol";

// Basically, Every time a interest payment comes back
// we keep a running total of dollars (totalInterestReceived) until it reaches the maxInterestDollarsEligible limit
// Every dollar of interest received from 0->maxInterestDollarsEligible
// has a allocated amount of rewards based on a sqrt function.

// When a interest payment comes in for a given Pool or the pool balance increases
// we recalculate the pool's accRewardsPerShare

// equation ref `_calculateNewRewards()`:
// (sqrtNewTotalInterest - sqrtOrigTotalInterest) / sqrtTotalRewards * (totalRewards / totalGFISupply)

// When a PoolToken is minted, we set the mint price to the pool's current accRewardsPerShare
// Every time a PoolToken withdraws rewards, we determine the allocated rewards,
// increase that PoolToken's rewardsClaimed, and transfer the owner the gfi

// equation to find a PoolToken's allocated rewards ref: `poolTokenClaimableRewards()`
// Token.principalAmount * (Pool.accRewardsPerShare - Token.accRewardsPerShareMintPrice) - Token.rewardsClaimed

contract PoolRewards is IPoolRewards, BaseUpgradeablePausable, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct PoolRewardsInfo {
    uint256 accRewardsPerShare; // accumulator gfi per interest dollar
  }

  struct PoolRewardsTokenInfo {
    uint256 rewardsClaimed; // gfi claimed
    uint256 accRewardsPerShareMintPrice; // Pool's accRewardsPerShare at PoolToken mint()
  }

  uint256 public totalRewards; // total amount of GFI rewards available
  uint256 public maxInterestDollarsEligible; // interest $ eligible for gfi rewards
  uint256 public totalInterestReceived; // counter of total interest repayments

  uint256 private sqrtTotalRewards; // sqrt(totalRewards)
  uint256 private totalRewardPercentOfTotalGFI; // totalRewards/totalGFISupply

  mapping(uint256 => PoolRewardsTokenInfo) public tokens; // poolTokenId -> PoolRewardsTokenInfo
  mapping(address => PoolRewardsInfo) public pools; // pool.address -> PoolRewardsInfo

  // TODO: define events
  event PoolRewardsAllocated();
  event PoolTokenRewardWithdraw();

  function __initialize__(address owner, GoldfinchConfig _config) public initializer {
    config = _config;
    __BaseUpgradeablePausable__init(owner);
  }

  function setTotalRewards(uint256 _totalRewards) public onlyAdmin {
    totalRewards = _totalRewards;
    sqrtTotalRewards = Babylonian.sqrt(_totalRewards);
    totalRewardPercentOfTotalGFI = _totalRewards.div(config.getGFI().totalSupply());
  }

  function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public onlyAdmin {
    maxInterestDollarsEligible = _maxInterestDollarsEligible;
  }

  // When a new interest payment is received by a pool, recalculate accRewardsPerShare
  function allocateRewards(address _poolAddress, uint256 _interestPaymentAmount) public override onlyAdmin {
    require(config.getPoolTokens().validPool(_poolAddress), "Not a valid pool");

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
  // PoolToken.principalAmount * (accRewardsPerShare-accRewardsPerShareMintPrice) - rewardsClaimed
  function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    return
      tokenInfo
        .principalAmount
        .mul(pools[tokenInfo.pool].accRewardsPerShare.sub(tokens[tokenId].accRewardsPerShareMintPrice))
        .sub(tokens[tokenId].rewardsClaimed);
  }

  // PoolToken request to withdraw currently allocated rewards
  function withdraw(uint256 tokenId, uint256 _amount) public onlyAdmin {
    uint256 totalClaimableRewards = poolTokenClaimableRewards(tokenId);
    uint256 poolTokenRewardsClaimed = tokens[tokenId].rewardsClaimed;
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    address poolAddr = tokenInfo.pool;
    require(poolAddr != address(0), "Invalid tokenId");
    require(poolTokenRewardsClaimed.add(_amount) <= totalClaimableRewards, "Rewards overwithdraw attempt");
    BaseUpgradeablePausable pool = BaseUpgradeablePausable(poolAddr);
    require(!pool.paused(), "Pool withdraw paused");
    tokens[tokenId].rewardsClaimed = poolTokenRewardsClaimed.add(_amount);
    safeERC20TransferFrom(config.getGFI(), address(this), poolTokens.ownerOf(tokenId), _amount);
    emit PoolTokenRewardWithdraw();
  }

  /* Internal functions  */

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
