// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {Babylonian} from "@uniswap/lib/contracts/libraries/Babylonian.sol";

import {SafeERC20Transfer} from "../library/SafeERC20Transfer.sol";
import {GoldfinchConfig} from "../protocol/core/GoldfinchConfig.sol";
import {ConfigHelper} from "../protocol/core/ConfigHelper.sol";
import {BaseUpgradeablePausable} from "../protocol/core/BaseUpgradeablePausable.sol";
import {IPoolTokens} from "../interfaces/IPoolTokens.sol";
import {ITranchedPool} from "../interfaces/ITranchedPool.sol";
import {IBackerRewards} from "../interfaces/IBackerRewards.sol";
import {IEvents} from "../interfaces/IEvents.sol";
import {IERC20withDec} from "../interfaces/IERC20withDec.sol";

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

contract BackerRewards is IBackerRewards, BaseUpgradeablePausable, IEvents {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeERC20Transfer for IERC20withDec;

  uint256 internal constant GFI_MANTISSA = 10 ** 18;
  uint256 internal constant FIDU_MANTISSA = 10 ** 18;
  uint256 internal constant USDC_MANTISSA = 10 ** 6;
  uint256 internal constant NUM_TRANCHES_PER_SLICE = 2;

  /// @inheritdoc IBackerRewards
  uint256 public override totalRewards;

  /// @inheritdoc IBackerRewards
  uint256 public override maxInterestDollarsEligible;

  /// @inheritdoc IBackerRewards
  uint256 public override totalInterestReceived;

  /// @inheritdoc IBackerRewards
  uint256 public override totalRewardPercentOfTotalGFI;

  mapping(uint256 => BackerRewardsTokenInfo) public tokens;
  mapping(address => BackerRewardsInfo) public pools;
  mapping(ITranchedPool => StakingRewardsPoolInfo) public poolStakingRewards;

  /// @notice Staking rewards info for each pool token
  mapping(uint256 => StakingRewardsTokenInfo) public tokenStakingRewards;

  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) public initializer {
    require(
      owner != address(0) && address(_config) != address(0),
      "Owner and config addresses cannot be empty"
    );
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  /// @inheritdoc IBackerRewards
  function allocateRewards(uint256 _interestPaymentAmount) external override onlyPool nonReentrant {
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
    totalRewardPercentOfTotalGFI = _totalRewards.mul(GFI_MANTISSA).div(totalGFISupply).mul(100);
    emit BackerRewardsSetTotalRewards(_msgSender(), _totalRewards, totalRewardPercentOfTotalGFI);
  }

  /**
   * @notice Set the total interest received to date.
   * This should only be called once on contract deploy.
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

  /// @inheritdoc IBackerRewards
  function setPoolTokenAccRewardsPerPrincipalDollarAtMint(
    address poolAddress,
    uint256 tokenId
  ) external override {
    require(_msgSender() == config.poolTokensAddress(), "Invalid sender!");
    require(config.getPoolTokens().validPool(poolAddress), "Invalid pool!");
    if (tokens[tokenId].accRewardsPerPrincipalDollarAtMint != 0) {
      return;
    }
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    require(poolAddress == tokenInfo.pool, "PoolAddress must equal PoolToken pool address");

    tokens[tokenId].accRewardsPerPrincipalDollarAtMint = pools[tokenInfo.pool]
      .accRewardsPerPrincipalDollar;
  }

  /// @inheritdoc IBackerRewards
  function onTranchedPoolDrawdown(uint256 _sliceIndex) external override onlyPool nonReentrant {
    // No-op so the call doesn't revert
  }

  /**
   * @inheritdoc IBackerRewards
   * @dev The sum of newRewardsClaimed across the split tokens MUST be equal to (or be very slightly smaller
   * than, in the case of rounding due to integer division) the original token's rewardsClaimed. Furthermore,
   * they must be split proportional to the original and new token's principalAmounts. This impl validates
   * neither of those things because only the pool tokens contract can call it, and it trusts that the PoolTokens
   * contract doesn't call maliciously.
   */
  function setBackerAndStakingRewardsTokenInfoOnSplit(
    BackerRewardsTokenInfo memory originalBackerRewardsTokenInfo,
    StakingRewardsTokenInfo memory originalStakingRewardsTokenInfo,
    uint256 newTokenId,
    uint256 newRewardsClaimed
  ) external override onlyPoolTokens {
    tokens[newTokenId] = BackerRewardsTokenInfo({
      rewardsClaimed: newRewardsClaimed,
      accRewardsPerPrincipalDollarAtMint: originalBackerRewardsTokenInfo
        .accRewardsPerPrincipalDollarAtMint
    });
    tokenStakingRewards[newTokenId] = originalStakingRewardsTokenInfo;
  }

  /// @inheritdoc IBackerRewards
  function clearTokenInfo(uint256 tokenId) external override onlyPoolTokens {
    delete tokens[tokenId];
    delete tokenStakingRewards[tokenId];
  }

  /// @inheritdoc IBackerRewards
  function getTokenInfo(
    uint256 poolTokenId
  ) external view override returns (BackerRewardsTokenInfo memory) {
    return tokens[poolTokenId];
  }

  /// @inheritdoc IBackerRewards
  function getStakingRewardsTokenInfo(
    uint256 poolTokenId
  ) external view override returns (StakingRewardsTokenInfo memory) {
    return tokenStakingRewards[poolTokenId];
  }

  /// @inheritdoc IBackerRewards
  function getBackerStakingRewardsPoolInfo(
    ITranchedPool pool
  ) external view override returns (StakingRewardsPoolInfo memory) {
    return poolStakingRewards[pool];
  }

  /**
   * @notice Calculate the gross available gfi rewards for a PoolToken
   * @param tokenId Pool token id
   * @return The amount of GFI claimable
   */
  function poolTokenClaimableRewards(uint256 tokenId) public view override returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    if (_isSeniorTrancheToken(tokenInfo)) {
      return 0;
    }

    // Note: If a TranchedPool is oversubscribed, reward allocations scale down proportionately.

    uint256 diffOfAccRewardsPerPrincipalDollar = pools[tokenInfo.pool]
      .accRewardsPerPrincipalDollar
      .sub(tokens[tokenId].accRewardsPerPrincipalDollarAtMint);
    uint256 rewardsClaimed = tokens[tokenId].rewardsClaimed.mul(GFI_MANTISSA);

    /*
      equation for token claimable rewards:
        token.principalAmount
        * (pool.accRewardsPerPrincipalDollar - token.accRewardsPerPrincipalDollarAtMint)
        - token.rewardsClaimed
    */

    return
      _usdcToAtomic(tokenInfo.principalAmount)
        .mul(diffOfAccRewardsPerPrincipalDollar)
        .sub(rewardsClaimed)
        .div(GFI_MANTISSA);
  }

  /**
   * @notice Calculates the amount of staking rewards already claimed for a PoolToken.
   * This function is provided for the sake of external (e.g. frontend client) consumption;
   * it is not necessary as an input to the mutative calculations in this contract.
   * @param tokenId Pool token id
   * @return The amount of GFI claimed
   */
  function stakingRewardsClaimed(uint256 tokenId) external view returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory poolTokenInfo = poolTokens.getTokenInfo(tokenId);

    if (_isSeniorTrancheToken(poolTokenInfo)) {
      return 0;
    }

    ITranchedPool pool = ITranchedPool(poolTokenInfo.pool);
    uint256 sliceIndex = _juniorTrancheIdToSliceIndex(poolTokenInfo.tranche);

    if (
      !_poolRewardsHaveBeenInitialized(pool) || !_sliceRewardsHaveBeenInitialized(pool, sliceIndex)
    ) {
      return 0;
    }

    StakingRewardsPoolInfo memory poolInfo = poolStakingRewards[pool];
    StakingRewardsSliceInfo memory sliceInfo = poolInfo.slicesInfo[sliceIndex];
    StakingRewardsTokenInfo memory tokenInfo = tokenStakingRewards[tokenId];

    uint256 sliceAccumulator = sliceInfo.accumulatedRewardsPerTokenAtDrawdown;
    uint256 tokenAccumulator = _getTokenAccumulatorAtLastWithdraw(tokenInfo, sliceInfo);
    uint256 rewardsPerFidu = tokenAccumulator.sub(sliceAccumulator);
    uint256 principalAsFidu = _fiduToUsdc(
      poolTokenInfo.principalAmount,
      sliceInfo.fiduSharePriceAtDrawdown
    );
    uint256 rewards = principalAsFidu.mul(rewardsPerFidu).div(FIDU_MANTISSA);
    return rewards;
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

  /// @inheritdoc IBackerRewards
  function withdraw(uint256 tokenId) public override whenNotPaused nonReentrant returns (uint256) {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    address poolAddr = tokenInfo.pool;
    require(config.getPoolTokens().validPool(poolAddr), "Invalid pool!");
    require(msg.sender == poolTokens.ownerOf(tokenId), "Must be owner of PoolToken");

    BaseUpgradeablePausable pool = BaseUpgradeablePausable(poolAddr);
    require(!pool.paused(), "Pool withdraw paused");

    ITranchedPool tranchedPool = ITranchedPool(poolAddr);
    require(!tranchedPool.creditLine().isLate(), "Pool is late on payments");

    require(!_isSeniorTrancheToken(tokenInfo), "Ineligible senior tranche token");

    uint256 claimableBackerRewards = poolTokenClaimableRewards(tokenId);
    uint256 claimableStakingRewards = stakingRewardsEarnedSinceLastWithdraw(tokenId);
    uint256 totalClaimableRewards = claimableBackerRewards.add(claimableStakingRewards);
    uint256 poolTokenRewardsClaimed = tokens[tokenId].rewardsClaimed;

    // Only account for claimed backer rewards, the staking rewards should not impact the
    // distribution of backer rewards
    tokens[tokenId].rewardsClaimed = poolTokenRewardsClaimed.add(claimableBackerRewards);

    if (claimableStakingRewards != 0) {
      _checkpointTokenStakingRewards(tokenId);
    }

    config.getGFI().safeERC20Transfer(poolTokens.ownerOf(tokenId), totalClaimableRewards);
    emit BackerRewardsClaimed(
      _msgSender(),
      tokenId,
      claimableBackerRewards,
      claimableStakingRewards
    );

    return totalClaimableRewards;
  }

  /**
   * @notice Returns the amount of staking rewards earned by a given token since the last
   * time its staking rewards were withdrawn.
   * @param tokenId token id to get rewards
   * @return amount of rewards
   */
  function stakingRewardsEarnedSinceLastWithdraw(uint256 tokenId) public view returns (uint256) {
    IPoolTokens.TokenInfo memory poolTokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    if (_isSeniorTrancheToken(poolTokenInfo)) {
      return 0;
    }

    ITranchedPool pool = ITranchedPool(poolTokenInfo.pool);
    uint256 sliceIndex = _juniorTrancheIdToSliceIndex(poolTokenInfo.tranche);

    if (
      !_poolRewardsHaveBeenInitialized(pool) || !_sliceRewardsHaveBeenInitialized(pool, sliceIndex)
    ) {
      return 0;
    }

    StakingRewardsPoolInfo memory poolInfo = poolStakingRewards[pool];
    StakingRewardsSliceInfo memory sliceInfo = poolInfo.slicesInfo[sliceIndex];
    StakingRewardsTokenInfo memory tokenInfo = tokenStakingRewards[tokenId];

    uint256 sliceAccumulator = _getSliceAccumulatorAtLastCheckpoint(sliceInfo, poolInfo);
    uint256 tokenAccumulator = _getTokenAccumulatorAtLastWithdraw(tokenInfo, sliceInfo);
    uint256 rewardsPerFidu = sliceAccumulator.sub(tokenAccumulator);
    uint256 principalAsFidu = _fiduToUsdc(
      poolTokenInfo.principalAmount,
      sliceInfo.fiduSharePriceAtDrawdown
    );
    uint256 rewards = principalAsFidu.mul(rewardsPerFidu).div(FIDU_MANTISSA);
    return rewards;
  }

  /* Internal functions  */
  function _allocateRewards(uint256 _interestPaymentAmount) internal {
    uint256 _totalInterestReceived = totalInterestReceived;
    if (_usdcToAtomic(_totalInterestReceived) >= maxInterestDollarsEligible) {
      return;
    }

    address _poolAddress = _msgSender();

    // Gross GFI Rewards earned for incoming interest dollars
    uint256 newGrossRewards = _calculateNewGrossGFIRewardsForInterestAmount(_interestPaymentAmount);

    ITranchedPool pool = ITranchedPool(_poolAddress);
    BackerRewardsInfo storage _poolInfo = pools[_poolAddress];

    uint256 totalJuniorDepositsAtomic = _usdcToAtomic(pool.totalJuniorDeposits());
    // If total junior deposits are 0, or less than 1, allocate no rewards. The latter condition
    // is necessary to prevent a perverse, "infinite mint" scenario in which we'd allocate
    // an even greater amount of rewards than `newGrossRewards`, due to dividing by less than 1.
    // This scenario and its mitigation are analogous to that of
    // `StakingRewards.additionalRewardsPerTokenSinceLastUpdate()`.

    if (totalJuniorDepositsAtomic < GFI_MANTISSA) {
      emit SafetyCheckTriggered();
      return;
    }

    // example: (6708203932437400000000 * 10^18) / (100000*10^18)
    _poolInfo.accRewardsPerPrincipalDollar = _poolInfo.accRewardsPerPrincipalDollar.add(
      newGrossRewards.mul(GFI_MANTISSA).div(totalJuniorDepositsAtomic)
    );

    totalInterestReceived = _totalInterestReceived.add(_interestPaymentAmount);
  }

  /**
   * @notice Updates the staking rewards accounting for for a given tokenId
   * @param tokenId token id to checkpoint
   */
  function _checkpointTokenStakingRewards(uint256 tokenId) internal {
    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    require(!_isSeniorTrancheToken(tokenInfo), "Ineligible senior tranche token");

    ITranchedPool pool = ITranchedPool(tokenInfo.pool);
    StakingRewardsPoolInfo memory poolInfo = poolStakingRewards[pool];
    uint256 sliceIndex = _juniorTrancheIdToSliceIndex(tokenInfo.tranche);
    StakingRewardsSliceInfo memory sliceInfo = poolInfo.slicesInfo[sliceIndex];

    uint256 newAccumulatedRewardsPerTokenAtLastWithdraw = _getSliceAccumulatorAtLastCheckpoint(
      sliceInfo,
      poolInfo
    );

    // If for any reason the new accumulator is less than our last one, abort for safety.
    if (
      newAccumulatedRewardsPerTokenAtLastWithdraw <
      tokenStakingRewards[tokenId].accumulatedRewardsPerTokenAtLastWithdraw
    ) {
      emit SafetyCheckTriggered();
      return;
    }

    tokenStakingRewards[tokenId]
      .accumulatedRewardsPerTokenAtLastWithdraw = newAccumulatedRewardsPerTokenAtLastWithdraw;
  }

  /**
   * @notice Calculate the rewards earned for a given interest payment
   * @param _interestPaymentAmount interest payment amount times 1e6
   */
  function _calculateNewGrossGFIRewardsForInterestAmount(
    uint256 _interestPaymentAmount
  ) internal view returns (uint256) {
    uint256 totalGFISupply = config.getGFI().totalSupply();

    // incoming interest payment, times * 1e18 divided by 1e6
    uint256 interestPaymentAmount = _usdcToAtomic(_interestPaymentAmount);

    // all-time interest payments prior to the incoming amount, times 1e18
    uint256 _previousTotalInterestReceived = _usdcToAtomic(totalInterestReceived);
    uint256 sqrtOrigTotalInterest = Babylonian.sqrt(_previousTotalInterestReceived);

    // sum of new interest payment + previous total interest payments, times 1e18
    uint256 newTotalInterest = _usdcToAtomic(
      _atomicToUsdc(_previousTotalInterestReceived).add(_atomicToUsdc(interestPaymentAmount))
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
      .div(GFI_MANTISSA);

    // Extra safety check to make sure the logic is capped at a ceiling of potential rewards
    // Calculating the gfi/$ for first dollar of interest to the protocol, and multiplying by new interest amount
    uint256 absoluteMaxGfiCheckPerDollar = Babylonian
      .sqrt((uint256)(1).mul(GFI_MANTISSA))
      .mul(totalRewardPercentOfTotalGFI)
      .div(sqrtMaxInterestDollarsEligible)
      .div(100)
      .mul(totalGFISupply)
      .div(GFI_MANTISSA);
    require(
      newGrossRewards < absoluteMaxGfiCheckPerDollar.mul(newTotalInterest),
      "newGrossRewards cannot be greater then the max gfi per dollar"
    );

    return newGrossRewards;
  }

  /**
   * @return Whether the provided `tokenInfo` is a token corresponding to a senior tranche.
   */
  function _isSeniorTrancheToken(
    IPoolTokens.TokenInfo memory tokenInfo
  ) internal pure returns (bool) {
    return tokenInfo.tranche.mod(NUM_TRANCHES_PER_SLICE) == 1;
  }

  /// @notice Returns an amount with the base of usdc (1e6) as an 1e18 number
  function _usdcToAtomic(uint256 amount) internal pure returns (uint256) {
    return amount.mul(GFI_MANTISSA).div(USDC_MANTISSA);
  }

  /// @notice Returns an amount with the base 1e18 as a usdc amount (1e6)
  function _atomicToUsdc(uint256 amount) internal pure returns (uint256) {
    return amount.div(GFI_MANTISSA.div(USDC_MANTISSA));
  }

  /// @notice Returns the equivalent amount of USDC given an amount of fidu and a share price
  /// @param amount amount of FIDU
  /// @param sharePrice share price of FIDU
  /// @return equivalent amount of USDC
  function _fiduToUsdc(uint256 amount, uint256 sharePrice) internal pure returns (uint256) {
    return _usdcToAtomic(amount).mul(FIDU_MANTISSA).div(sharePrice);
  }

  /// @notice Returns the slice index for the given junior tranche id
  /// @param trancheId tranche id
  /// @return slice index that the given tranche id belongs to
  function _juniorTrancheIdToSliceIndex(uint256 trancheId) internal pure returns (uint256) {
    return trancheId.sub(1).div(2);
  }

  /// @notice Returns true if a TranchedPool's rewards parameters have been initialized, otherwise false
  /// @param pool pool to check rewards info
  function _poolRewardsHaveBeenInitialized(ITranchedPool pool) internal view returns (bool) {
    StakingRewardsPoolInfo memory poolInfo = poolStakingRewards[pool];
    return _poolStakingRewardsInfoHaveBeenInitialized(poolInfo);
  }

  /// @notice Returns true if a given pool's staking rewards parameters have been initialized
  function _poolStakingRewardsInfoHaveBeenInitialized(
    StakingRewardsPoolInfo memory poolInfo
  ) internal pure returns (bool) {
    return poolInfo.accumulatedRewardsPerTokenAtLastCheckpoint != 0;
  }

  /// @notice Returns true if a TranchedPool's slice's rewards parameters have been initialized, otherwise false
  function _sliceRewardsHaveBeenInitialized(
    ITranchedPool pool,
    uint256 sliceIndex
  ) internal view returns (bool) {
    StakingRewardsPoolInfo memory poolInfo = poolStakingRewards[pool];
    return
      poolInfo.slicesInfo.length > sliceIndex &&
      poolInfo.slicesInfo[sliceIndex].unrealizedAccumulatedRewardsPerTokenAtLastCheckpoint != 0;
  }

  /// @notice Return a slice's rewards accumulator if it has been intialized,
  ///           otherwise return the TranchedPool's accumulator
  function _getSliceAccumulatorAtLastCheckpoint(
    StakingRewardsSliceInfo memory sliceInfo,
    StakingRewardsPoolInfo memory poolInfo
  ) internal pure returns (uint256) {
    require(
      poolInfo.accumulatedRewardsPerTokenAtLastCheckpoint != 0,
      "unsafe: pool accumulator hasn't been initialized"
    );
    bool sliceHasNotReceivedAPayment = sliceInfo.accumulatedRewardsPerTokenAtLastCheckpoint == 0;
    return
      sliceHasNotReceivedAPayment
        ? poolInfo.accumulatedRewardsPerTokenAtLastCheckpoint
        : sliceInfo.accumulatedRewardsPerTokenAtLastCheckpoint;
  }

  /// @notice Return a tokenss rewards accumulator if its been initialized, otherwise return the slice's accumulator
  function _getTokenAccumulatorAtLastWithdraw(
    StakingRewardsTokenInfo memory tokenInfo,
    StakingRewardsSliceInfo memory sliceInfo
  ) internal pure returns (uint256) {
    require(
      sliceInfo.accumulatedRewardsPerTokenAtDrawdown != 0,
      "unsafe: slice accumulator hasn't been initialized"
    );
    bool hasNotWithdrawn = tokenInfo.accumulatedRewardsPerTokenAtLastWithdraw == 0;
    if (hasNotWithdrawn) {
      return sliceInfo.accumulatedRewardsPerTokenAtDrawdown;
    } else {
      require(
        tokenInfo.accumulatedRewardsPerTokenAtLastWithdraw >=
          sliceInfo.accumulatedRewardsPerTokenAtDrawdown,
        "Unexpected token accumulator"
      );
      return tokenInfo.accumulatedRewardsPerTokenAtLastWithdraw;
    }
  }

  /* ======== MODIFIERS  ======== */

  modifier onlyPoolTokens() {
    require(msg.sender == address(config.getPoolTokens()), "Not PoolTokens");
    _;
  }

  modifier onlyPool() {
    require(config.getPoolTokens().validPool(_msgSender()), "Invalid pool!");
    _;
  }

  /* ======== EVENTS ======== */
  event BackerRewardsClaimed(
    address indexed owner,
    uint256 indexed tokenId,
    uint256 amountOfTranchedPoolRewards,
    uint256 amountOfSeniorPoolRewards
  );
  event BackerRewardsSetTotalRewards(
    address indexed owner,
    uint256 totalRewards,
    uint256 totalRewardPercentOfTotalGFI
  );
  event BackerRewardsSetTotalInterestReceived(address indexed owner, uint256 totalInterestReceived);
  event BackerRewardsSetMaxInterestDollarsEligible(
    address indexed owner,
    uint256 maxInterestDollarsEligible
  );
}
