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
import "../interfaces/IBackerRewards.sol";

// Basically, Every time a interest payment comes back
// we keep a running total of dollars (totalInterestReceived) until it reaches the maxInterestDollarsEligible limit
// Every dollar of interest received from 0->maxInterestDollarsEligible
// has a allocated amount of rewards based on a sqrt function.

// When a interest payment comes in for a given Pool or the pool balance increases
// we recalculate the pool's accRewardsPerPrincipalDollar

// equation ref `_calculateNewGrossGFIRewardsForInterestAmount()`:
// (sqrtNewTotalInterest - sqrtOrigTotalInterest) / sqrtMaxInterestDollarsEligible * (totalRewards / totalGFISupply)

// When a PoolToken is minted, we set the mint price to the pool's current accRewardsPerPrincipalDollar
// Every time a PoolToken withdraws rewards, we determine the allocated rewards,
// increase that PoolToken's rewardsClaimed, and transfer the owner the gfi

contract BackerRewards is IBackerRewards, BaseUpgradeablePausable, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct BackerRewardsInfo {
    uint256 accRewardsPerPrincipalDollar; // accumulator gfi per interest dollar
  }

  struct BackerRewardsTokenInfo {
    uint256 rewardsClaimed; // gfi claimed
    uint256 accRewardsPerPrincipalDollarAtMint; // Pool's accRewardsPerPrincipalDollar at PoolToken mint()
  }

  uint256 public totalRewards; // total amount of GFI rewards available, times 1e18
  uint256 public maxInterestDollarsEligible; // interest $ eligible for gfi rewards, times 1e18
  uint256 public totalInterestReceived; // counter of total interest repayments, times 1e6
  uint256 public totalRewardPercentOfTotalGFI; // totalRewards/totalGFISupply, times 1e18

  mapping(uint256 => BackerRewardsTokenInfo) public tokens; // poolTokenId -> BackerRewardsTokenInfo

  mapping(address => BackerRewardsInfo) public pools; // pool.address -> BackerRewardsInfo

  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  /**
   * @notice Calculates the accRewardsPerPrincipalDollar for a given pool,
   when a interest payment is received by the protocol
   * @param _interestPaymentAmount The amount of total dollars the interest payment, expects 10^6 value
   */
  function allocateRewards(uint256 _interestPaymentAmount) external override onlyPool {
    // note: do not use a require statment because that will TranchedPool kill execution
    if (_interestPaymentAmount > 0) {
      _allocateRewards(_interestPaymentAmount);
    }
  }

  /**
   * @notice Set the total gfi rewards and the % of total GFI
   * @param _totalRewards The amount of GFI rewards available, expects 10^18 value
   */
  function setTotalRewards(uint256 _totalRewards) public onlyAdmin {
    totalRewards = _totalRewards;
    uint256 totalGFISupply = config.getGFI().totalSupply();
    totalRewardPercentOfTotalGFI = _totalRewards.mul(mantissa()).div(totalGFISupply).mul(100);
    emit BackerRewardsSetTotalRewards(_msgSender(), _totalRewards, totalRewardPercentOfTotalGFI);
  }

  /**
   * @notice Set the total interest received to date.
   This should only be called once on contract deploy.
   * @param _totalInterestReceived The amount of interest the protocol has received to date, expects 10^6 value
   */
  function setTotalInterestReceived(uint256 _totalInterestReceived) public onlyAdmin {
    totalInterestReceived = _totalInterestReceived;
    emit BackerRewardsSetTotalInterestReceived(_msgSender(), _totalInterestReceived);
  }

  /**
   * @notice Set the max dollars across the entire protocol that are eligible for GFI rewards
   * @param _maxInterestDollarsEligible The amount of interest dollars eligible for GFI rewards, expects 10^18 value
   */
  function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public onlyAdmin {
    maxInterestDollarsEligible = _maxInterestDollarsEligible;
    emit BackerRewardsSetMaxInterestDollarsEligible(_msgSender(), _maxInterestDollarsEligible);
  }

  /**
   * @notice When a pool token is minted for multiple drawdowns,
   set accRewardsPerPrincipalDollarAtMint to the current accRewardsPerPrincipalDollar price
   * @param tokenId Pool token id
   */
  function setPoolTokenAccRewardsPerPrincipalDollarAtMint(address poolAddress, uint256 tokenId) external override {
    require(_msgSender() == config.poolTokensAddress(), "Invalid sender!");
    require(config.getPoolTokens().validPool(poolAddress), "Invalid pool!");
    if (tokens[tokenId].accRewardsPerPrincipalDollarAtMint != 0) {
      return;
    }
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    require(poolAddress == tokenInfo.pool, "PoolAddress must equal PoolToken pool address");

    tokens[tokenId].accRewardsPerPrincipalDollarAtMint = pools[tokenInfo.pool].accRewardsPerPrincipalDollar;
  }

  /**
   * @notice Calculate the gross available gfi rewards for a PoolToken
   * @param tokenId Pool token id
   * @return The amount of GFI claimable
   */
  function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    // Note: If a TranchedPool is oversubscribed, reward allocation's scale down proportionately.

    uint256 diffOfAccRewardsPerPrincipalDollar = pools[tokenInfo.pool].accRewardsPerPrincipalDollar.sub(
      tokens[tokenId].accRewardsPerPrincipalDollarAtMint
    );
    uint256 rewardsClaimed = tokens[tokenId].rewardsClaimed.mul(mantissa());

    /*
      equation for token claimable rewards:
        token.principalAmount
        * (pool.accRewardsPerPrincipalDollar - token.accRewardsPerPrincipalDollarAtMint)
        - token.rewardsClaimed
    */

    return
      usdcToAtomic(tokenInfo.principalAmount).mul(diffOfAccRewardsPerPrincipalDollar).sub(rewardsClaimed).div(
        mantissa()
      );
  }

  /**
   * @notice PoolToken request to withdraw multiple PoolTokens allocated rewards
   * @param tokenIds Array of pool token id
   */
  function withdrawMultiple(uint256[] calldata tokenIds) public {
    require(tokenIds.length > 0, "TokensIds length must not be 0");

    for (uint256 i = 0; i < tokenIds.length; i++) {
      withdraw(tokenIds[i]);
    }
  }

  /**
   * @notice PoolToken request to withdraw all allocated rewards
   * @param tokenId Pool token id
   */
  function withdraw(uint256 tokenId) public {
    uint256 totalClaimableRewards = poolTokenClaimableRewards(tokenId);
    uint256 poolTokenRewardsClaimed = tokens[tokenId].rewardsClaimed;
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    address poolAddr = tokenInfo.pool;
    require(config.getPoolTokens().validPool(poolAddr), "Invalid pool!");
    require(msg.sender == poolTokens.ownerOf(tokenId), "Must be owner of PoolToken");

    BaseUpgradeablePausable pool = BaseUpgradeablePausable(poolAddr);
    require(!pool.paused(), "Pool withdraw paused");

    ITranchedPool tranchedPool = ITranchedPool(poolAddr);
    require(!tranchedPool.creditLine().isLate(), "Pool is late on payments");

    tokens[tokenId].rewardsClaimed = poolTokenRewardsClaimed.add(totalClaimableRewards);
    safeERC20Transfer(config.getGFI(), poolTokens.ownerOf(tokenId), totalClaimableRewards);
    emit BackerRewardsClaimed(_msgSender(), tokenId, totalClaimableRewards);
  }

  /* Internal functions  */
  function _allocateRewards(uint256 _interestPaymentAmount) internal {
    uint256 _totalInterestReceived = totalInterestReceived;
    if (usdcToAtomic(_totalInterestReceived) >= maxInterestDollarsEligible) {
      return;
    }

    address _poolAddress = _msgSender();

    // Gross GFI Rewards earned for incoming interest dollars
    uint256 newGrossRewards = _calculateNewGrossGFIRewardsForInterestAmount(_interestPaymentAmount);

    ITranchedPool pool = ITranchedPool(_poolAddress);
    BackerRewardsInfo storage _poolInfo = pools[_poolAddress];

    uint256 totalJuniorDeposits = pool.totalJuniorDeposits();
    if (totalJuniorDeposits == 0) {
      return;
    }

    // example: (6708203932437400000000 * 10^18) / (100000*10^18)
    _poolInfo.accRewardsPerPrincipalDollar = _poolInfo.accRewardsPerPrincipalDollar.add(
      newGrossRewards.mul(mantissa()).div(usdcToAtomic(totalJuniorDeposits))
    );

    totalInterestReceived = _totalInterestReceived.add(_interestPaymentAmount);
  }

  /**
   * @notice Calculate the rewards earned for a given interest payment
   * @param _interestPaymentAmount interest payment amount times 1e6
   */
  function _calculateNewGrossGFIRewardsForInterestAmount(uint256 _interestPaymentAmount)
    internal
    view
    returns (uint256)
  {
    uint256 totalGFISupply = config.getGFI().totalSupply();

    // incoming interest payment, times * 1e18 divided by 1e6
    uint256 interestPaymentAmount = usdcToAtomic(_interestPaymentAmount);

    // all-time interest payments prior to the incoming amount, times 1e18
    uint256 _previousTotalInterestReceived = usdcToAtomic(totalInterestReceived);
    uint256 sqrtOrigTotalInterest = Babylonian.sqrt(_previousTotalInterestReceived);

    // sum of new interest payment + previous total interest payments, times 1e18
    uint256 newTotalInterest = usdcToAtomic(
      atomicToUSDC(_previousTotalInterestReceived).add(atomicToUSDC(interestPaymentAmount))
    );

    // interest payment passed the maxInterestDollarsEligible cap, should only partially be rewarded
    if (newTotalInterest > maxInterestDollarsEligible) {
      newTotalInterest = maxInterestDollarsEligible;
    }

    /*
      equation:
        (sqrtNewTotalInterest-sqrtOrigTotalInterest)
        * totalRewardPercentOfTotalGFI
        / sqrtMaxInterestDollarsEligible
        / 100
        * totalGFISupply
        / 10^18

      example scenario:
      - new payment = 5000*10^18
      - original interest received = 0*10^18
      - total reward percent = 3 * 10^18
      - max interest dollars = 1 * 10^27 ($1 billion)
      - totalGfiSupply = 100_000_000 * 10^18

      example math:
        (70710678118 - 0)
        * 3000000000000000000
        / 31622776601683
        / 100
        * 100000000000000000000000000
        / 10^18
        = 6708203932437400000000 (6,708.2039 GFI)
    */
    uint256 sqrtDiff = Babylonian.sqrt(newTotalInterest).sub(sqrtOrigTotalInterest);
    uint256 sqrtMaxInterestDollarsEligible = Babylonian.sqrt(maxInterestDollarsEligible);

    require(sqrtMaxInterestDollarsEligible > 0, "maxInterestDollarsEligible must not be zero");

    uint256 newGrossRewards = sqrtDiff
      .mul(totalRewardPercentOfTotalGFI)
      .div(sqrtMaxInterestDollarsEligible)
      .div(100)
      .mul(totalGFISupply)
      .div(mantissa());

    // Extra safety check to make sure the logic is capped at a ceiling of potential rewards
    // Calculating the gfi/$ for first dollar of interest to the protocol, and multiplying by new interest amount
    uint256 absoluteMaxGfiCheckPerDollar = Babylonian
      .sqrt((uint256)(1).mul(mantissa()))
      .mul(totalRewardPercentOfTotalGFI)
      .div(sqrtMaxInterestDollarsEligible)
      .div(100)
      .mul(totalGFISupply)
      .div(mantissa());
    require(
      newGrossRewards < absoluteMaxGfiCheckPerDollar.mul(newTotalInterest),
      "newGrossRewards cannot be greater then the max gfi per dollar"
    );

    return newGrossRewards;
  }

  function mantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(18);
  }

  function usdcMantissa() internal pure returns (uint256) {
    return uint256(10)**uint256(6);
  }

  function usdcToAtomic(uint256 amount) internal pure returns (uint256) {
    return amount.mul(mantissa()).div(usdcMantissa());
  }

  function atomicToUSDC(uint256 amount) internal pure returns (uint256) {
    return amount.div(mantissa().div(usdcMantissa()));
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
    emit GoldfinchConfigUpdated(_msgSender(), address(config));
  }

  /* ======== MODIFIERS  ======== */

  modifier onlyPool() {
    require(config.getPoolTokens().validPool(_msgSender()), "Invalid pool!");
    _;
  }

  /* ======== EVENTS ======== */
  event GoldfinchConfigUpdated(address indexed who, address configAddress);
  event BackerRewardsClaimed(address indexed owner, uint256 indexed tokenId, uint256 amount);
  event BackerRewardsSetTotalRewards(address indexed owner, uint256 totalRewards, uint256 totalRewardPercentOfTotalGFI);
  event BackerRewardsSetTotalInterestReceived(address indexed owner, uint256 totalInterestReceived);
  event BackerRewardsSetMaxInterestDollarsEligible(address indexed owner, uint256 maxInterestDollarsEligible);
}
