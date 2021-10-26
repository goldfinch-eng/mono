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
// we recalculate the pool's accRewardsPerPrincipalShare

// equation ref `_calculateNewGrossGFIRewardsForInterestAmount()`:
// (sqrtNewTotalInterest - sqrtOrigTotalInterest) / sqrtMaxInterestDollarsEligible * (totalRewards / totalGFISupply)

// When a PoolToken is minted, we set the mint price to the pool's current accRewardsPerPrincipalShare
// Every time a PoolToken withdraws rewards, we determine the allocated rewards,
// increase that PoolToken's rewardsClaimed, and transfer the owner the gfi

contract PoolRewards is IPoolRewards, BaseUpgradeablePausable, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct PoolRewardsInfo {
    uint256 accRewardsPerPrincipalShare; // accumulator gfi per interest dollar
  }

  struct PoolRewardsTokenInfo {
    uint256 rewardsClaimed; // gfi claimed
    uint256 accRewardsPerPrincipalShareAtMint; // Pool's accRewardsPerPrincipalShare at PoolToken mint()
  }

  uint256 public totalRewards; // total amount of GFI rewards available, times 1e18
  uint256 public maxInterestDollarsEligible; // interest $ eligible for gfi rewards, times 1e18
  uint256 public totalInterestReceived; // counter of total interest repayments, times 1e6
  uint256 public totalRewardPercentOfTotalGFI; // totalRewards/totalGFISupply, times 1e18

  mapping(uint256 => PoolRewardsTokenInfo) public tokens; // poolTokenId -> PoolRewardsTokenInfo
  mapping(address => PoolRewardsInfo) public pools; // pool.address -> PoolRewardsInfo

  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
    totalInterestReceived = 0;
  }

  /**
   * @notice Calculates the accRewardsPerPrincipalShare for a given pool,
   when a interest payment is received by the protocol
   * @param _interestPaymentAmount The amount of total dollars the interest payment, expects 10^6 value
   */
  function allocateRewards(uint256 _interestPaymentAmount) external override onlyPool {
    _allocateRewards(_interestPaymentAmount);
  }

  /**
   * @notice Set the total gfi rewards and the % of total GFI
   * @param _totalRewards The amount of GFI rewards available, expects 10^18 value
   */
  function setTotalRewards(uint256 _totalRewards) public onlyAdmin {
    totalRewards = _totalRewards;
    uint256 totalGFISupply = config.getGFI().totalSupply();
    totalRewardPercentOfTotalGFI = _totalRewards.mul(fiduMantissa()).div(totalGFISupply).mul(100);
  }

  /**
   * @notice Set the total interest received to date.
   This should only be called once on contract deploy.
   * @param _totalInterestReceived The amount of interest the protocol has received to date, expects 10^6 value
   */
  function setTotalInterestReceived(uint256 _totalInterestReceived) public onlyAdmin {
    totalInterestReceived = _totalInterestReceived;
  }

  /**
   * @notice Set the max dollars across the entire protocol that are eligible for GFI rewards
   * @param _maxInterestDollarsEligible The amount of interest dollars eligible for GFI rewards, expects 10^18 value
   */
  function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public onlyAdmin {
    maxInterestDollarsEligible = _maxInterestDollarsEligible;
  }

  /**
   * @notice Calculate the gross available gfi rewards for a PoolToken
   * @param tokenId Pool token id
   * @return The amount of GFI claimable
   */
  function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    // TODO: security vulnerability Since our pools allow people to deposit beyond the limit,
    // we should adjust for that and only allow claiming for capital that was at risk.
    uint256 claimableRewards = usdcToFidu(tokenInfo.principalAmount)
      .mul(pools[tokenInfo.pool].accRewardsPerPrincipalShare.sub(tokens[tokenId].accRewardsPerPrincipalShareAtMint))
      .sub(tokens[tokenId].rewardsClaimed.mul(fiduMantissa()))
      .div(fiduMantissa());

    return claimableRewards;
  }

  /**
   * @notice PoolToken request to withdraw currently allocated rewards
   * @param tokenId Pool token id
   * @param _amount amount of GFI, times 10^18
   */
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
    safeERC20Approve(config.getGFI(), address(this), _amount);
    safeERC20TransferFrom(config.getGFI(), address(this), poolTokens.ownerOf(tokenId), _amount);
  }

  /* Internal functions  */

  // When a new interest payment is received by a pool, recalculate accRewardsPerPrincipalShare
  function _allocateRewards(uint256 _interestPaymentAmount) internal {
    address _poolAddress = _msgSender();
    uint256 _totalInterestReceived = totalInterestReceived;

    require(usdcToFidu(_totalInterestReceived) < maxInterestDollarsEligible, "All rewards exhausted");

    // Gross GFI Rewards earned for incoming interest dollars
    uint256 newGrossRewards = _calculateNewGrossGFIRewardsForInterestAmount(_interestPaymentAmount);

    ITranchedPool pool = ITranchedPool(_poolAddress);
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));
    PoolRewardsInfo storage _poolInfo = pools[_poolAddress];

    if (_totalInterestReceived != 0) {
      _poolInfo.accRewardsPerPrincipalShare = _poolInfo.accRewardsPerPrincipalShare.add(
        newGrossRewards.mul(fiduMantissa()).div(usdcToFidu(juniorTranche.principalDeposited))
      );
    } else {
      _poolInfo.accRewardsPerPrincipalShare = newGrossRewards.mul(fiduMantissa()).div(
        usdcToFidu(juniorTranche.principalDeposited)
      );
    }

    totalInterestReceived = _totalInterestReceived.add(_interestPaymentAmount);
  }

  // Calculate the rewards earned for a given interest payment
  // @input: interestPaymentAmount = interest payment amount times 1e6
  function _calculateNewGrossGFIRewardsForInterestAmount(uint256 _interestPaymentAmount)
    internal
    view
    returns (uint256)
  {
    uint256 totalGFISupply = config.getGFI().totalSupply();

    // incoming interest payment, times * 1e18 divided by 1e6
    uint256 interestPaymentAmount = usdcToFidu(_interestPaymentAmount);

    // all-time interest payments prior to the incoming amount, times 1e18
    uint256 _previousTotalInterestReceived = usdcToFidu(totalInterestReceived);
    uint256 sqrtOrigTotalInterest = Babylonian.sqrt(_previousTotalInterestReceived);

    // sum of new interest payment + previous total interest payments, times 1e18
    uint256 newTotalInterest = usdcToFidu(
      fiduToUSDC(_previousTotalInterestReceived).add(fiduToUSDC(interestPaymentAmount))
    );

    // interest payment passed the maxInterestDollarsEligible cap, should only partially be rewarded
    if (newTotalInterest > maxInterestDollarsEligible) {
      newTotalInterest = maxInterestDollarsEligible;
    }

    uint256 a = Babylonian.sqrt(newTotalInterest).sub(sqrtOrigTotalInterest);
    uint256 b = Babylonian.sqrt(maxInterestDollarsEligible);
    uint256 newGrossRewards = a.mul(totalRewardPercentOfTotalGFI).div(b).div(100).mul(totalGFISupply).div(
      fiduMantissa()
    );

    return newGrossRewards;
  }

  function fiduMantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(18);
  }

  function usdcMantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(6);
  }

  function usdcToFidu(uint256 amount) internal pure returns (uint256) {
    return amount.mul(fiduMantissa()).div(usdcMantissa());
  }

  function fiduToUSDC(uint256 amount) internal pure returns (uint256) {
    return amount.div(fiduMantissa().div(usdcMantissa()));
  }

  modifier onlyPool() {
    require(config.getPoolTokens().validPool(_msgSender()), "Invalid pool!");
    _;
  }
}
