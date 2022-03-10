// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/drafts/IERC20Permit.sol";

import "../external/ERC721PresetMinterPauserAutoId.sol";
import "../interfaces/IERC20withDec.sol";
import "../interfaces/ISeniorPool.sol";
import "../interfaces/IStakingRewards.sol";
import "../protocol/core/GoldfinchConfig.sol";
import "../protocol/core/ConfigHelper.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";

import "../library/StakingRewardsVesting.sol";

// solhint-disable-next-line max-states-count
contract StakingRewards is ERC721PresetMinterPauserAutoIdUpgradeSafe, ReentrancyGuardUpgradeSafe {
  using SafeMath for uint256;
  using SafeERC20 for IERC20withDec;
  using ConfigHelper for GoldfinchConfig;

  using StakingRewardsVesting for StakingRewardsVesting.Rewards;

  enum LockupPeriod {
    SixMonths,
    TwelveMonths,
    TwentyFourMonths
  }

  enum StakedPositionType {
    Fidu,
    CurveLP
  }

  struct StakedPosition {
    // @notice Staked amount denominated in `stakingToken().decimals()`
    uint256 amount;
    // @notice Struct describing rewards owed with vesting
    StakingRewardsVesting.Rewards rewards;
    // @notice Multiplier applied to staked amount when locking up position
    uint256 leverageMultiplier;
    // @notice Time in seconds after which position can be unstaked
    uint256 lockedUntil;
    // @notice Type of the staked position
    StakedPositionType positionType;
    // @notice Multiplier applied to staked amount to denominate in `baseStakingToken().decimals()`
    uint256 effectiveMultiplier;
    // @notice Exchange rate applied to staked amount to denominate in `baseStakingToken().decimals()`
    uint256 baseTokenExchangeRate;
  }

  /* ========== EVENTS =================== */
  event RewardsParametersUpdated(
    address indexed who,
    uint256 targetCapacity,
    uint256 minRate,
    uint256 maxRate,
    uint256 minRateAtPercent,
    uint256 maxRateAtPercent
  );
  event TargetCapacityUpdated(address indexed who, uint256 targetCapacity);
  event VestingScheduleUpdated(address indexed who, uint256 vestingLength);
  event MinRateUpdated(address indexed who, uint256 minRate);
  event MaxRateUpdated(address indexed who, uint256 maxRate);
  event MinRateAtPercentUpdated(address indexed who, uint256 minRateAtPercent);
  event MaxRateAtPercentUpdated(address indexed who, uint256 maxRateAtPercent);
  event EffectiveMultiplierUpdated(address indexed who, StakedPositionType positionType, uint256 multiplier);

  /* ========== STATE VARIABLES ========== */

  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

  bytes32 public constant ZAPPER_ROLE = keccak256("ZAPPER_ROLE");

  GoldfinchConfig public config;

  /// @notice The block timestamp when rewards were last checkpointed
  uint256 public lastUpdateTime;

  /// @notice Accumulated rewards per token at the last checkpoint
  uint256 public accumulatedRewardsPerToken;

  /// @notice Total rewards available for disbursement at the last checkpoint, denominated in `rewardsToken()`
  uint256 public rewardsAvailable;

  /// @notice StakedPosition tokenId => accumulatedRewardsPerToken at the position's last checkpoint
  mapping(uint256 => uint256) public positionToAccumulatedRewardsPerToken;

  /// @notice Desired supply of staked tokens. The reward rate adjusts in a range
  ///   around this value to incentivize staking or unstaking to maintain it.
  uint256 public targetCapacity;

  /// @notice The minimum total disbursed rewards per second, denominated in `rewardsToken()`
  uint256 public minRate;

  /// @notice The maximum total disbursed rewards per second, denominated in `rewardsToken()`
  uint256 public maxRate;

  /// @notice The percent of `targetCapacity` at which the reward rate reaches `maxRate`.
  ///  Represented with `MULTIPLIER_DECIMALS`.
  uint256 public maxRateAtPercent;

  /// @notice The percent of `targetCapacity` at which the reward rate reaches `minRate`.
  ///  Represented with `MULTIPLIER_DECIMALS`.
  uint256 public minRateAtPercent;

  /// @notice The duration in seconds over which rewards vest
  uint256 public vestingLength;

  /// @dev Supply of staked tokens, denominated in `stakingToken().decimals()`
  uint256 public totalStakedSupply;

  /// @dev UNUSED (definition kept for storage slot)
  uint256 private totalLeveragedStakedSupply;

  /// @dev UNUSED (definition kept for storage slot)
  mapping(LockupPeriod => uint256) private leverageMultipliers;

  /// @dev NFT tokenId => staked position
  mapping(uint256 => StakedPosition) public positions;

  /// @dev A mapping of staked position types to multipliers used to denominate positions
  ///   in `baseStakingToken()`. Represented with `MULTIPLIER_DECIMALS`.
  mapping(StakedPositionType => uint256) private effectiveMultipliers;

  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) external initializer {
    __Context_init_unchained();
    __ERC165_init_unchained();
    __ERC721_init_unchained("Goldfinch V2 LP Staking Tokens", "GFI-V2-LPS");
    __ERC721Pausable_init_unchained();
    __AccessControl_init_unchained();
    __Pausable_init_unchained();
    __ReentrancyGuard_init_unchained();

    _setupRole(OWNER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);

    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);

    config = _config;

    vestingLength = 365 days;
  }

  function initZapperRole() external onlyAdmin {
    _setRoleAdmin(ZAPPER_ROLE, OWNER_ROLE);
  }

  /* ========== VIEWS ========== */

  /// @notice Returns the staked balance of a given position token
  /// @param tokenId A staking position token ID
  /// @return Amount of staked tokens denominated in `stakingToken().decimals()`
  function stakedBalanceOf(uint256 tokenId) external view returns (uint256) {
    return positions[tokenId].amount;
  }

  /// @notice The address of the token being disbursed as rewards
  function rewardsToken() public view returns (IERC20withDec) {
    return config.getGFI();
  }

  /// @notice The address of the token that is staked for a given position type
  function stakingToken(StakedPositionType positionType) public view returns (IERC20withDec) {
    if (positionType == StakedPositionType.CurveLP) {
      return config.getFiduUSDCCurveLP();
    }

    return config.getFidu();
  }

  /// @notice The address of the base token used to denominate staking rewards
  function baseStakingToken() public view returns (IERC20withDec) {
    return config.getFidu();
  }

  /// @notice The additional rewards earned per token, between the provided time and the last
  ///   time rewards were checkpointed, given the prevailing `rewardRate()`. This amount is limited
  ///   by the amount of rewards that are available for distribution; if there aren't enough
  ///   rewards in the balance of this contract, then we shouldn't be giving them out.
  /// @return Amount of rewards denominated in `rewardsToken().decimals()`.
  function _additionalRewardsPerTokenSinceLastUpdate(uint256 time) internal view returns (uint256) {
    require(time >= lastUpdateTime, "invalid time");

    if (totalStakedSupply == 0) {
      return 0;
    }
    uint256 rewardsSinceLastUpdate = Math.min(time.sub(lastUpdateTime).mul(rewardRate()), rewardsAvailable);
    uint256 additionalRewardsPerToken = rewardsSinceLastUpdate.mul(stakingTokenMantissa()).div(totalStakedSupply);
    // Prevent perverse, infinite-mint scenario where totalStakedSupply is a fraction of a token.
    // Since it's used as the denominator, this could make additionalRewardPerToken larger than the total number
    // of tokens that should have been disbursed in the elapsed time. The attacker would need to find
    // a way to reduce totalStakedSupply while maintaining a staked position of >= 1.
    // See: https://twitter.com/Mudit__Gupta/status/1409463917290557440
    if (additionalRewardsPerToken > rewardsSinceLastUpdate) {
      return 0;
    }
    return additionalRewardsPerToken;
  }

  /// @notice Returns accumulated rewards per token up to the current block timestamp
  /// @return Amount of rewards denominated in `rewardsToken().decimals()`
  function rewardPerToken() public view returns (uint256) {
    uint256 additionalRewardsPerToken = _additionalRewardsPerTokenSinceLastUpdate(block.timestamp);
    return accumulatedRewardsPerToken.add(additionalRewardsPerToken);
  }

  /// @notice Returns rewards earned by a given position token from its last checkpoint up to the
  ///   current block timestamp.
  /// @param tokenId A staking position token ID
  /// @return Amount of rewards denominated in `rewardsToken().decimals()`
  function earnedSinceLastCheckpoint(uint256 tokenId) public view returns (uint256) {
    return
      _positionToEffectiveAmount(positions[tokenId])
        .mul(rewardPerToken().sub(positionToAccumulatedRewardsPerToken[tokenId]))
        .div(stakingTokenMantissa());
  }

  function totalOptimisticClaimable(address owner) external view returns (uint256) {
    uint256 result = 0;
    for (uint256 i = 0; i < balanceOf(owner); i++) {
      uint256 tokenId = tokenOfOwnerByIndex(owner, i);
      result = result.add(optimisticClaimable(tokenId));
    }
    return result;
  }

  function optimisticClaimable(uint256 tokenId) public view returns (uint256) {
    return earnedSinceLastCheckpoint(tokenId).add(claimableRewards(tokenId));
  }

  /// @notice Returns the rewards claimable by a given position token at the most recent checkpoint, taking into
  ///   account vesting schedule.
  /// @return rewards Amount of rewards denominated in `rewardsToken()`
  function claimableRewards(uint256 tokenId) public view returns (uint256 rewards) {
    return positions[tokenId].rewards.claimable();
  }

  /// @notice Returns the rewards that will have vested for some position with the given params.
  /// @return rewards Amount of rewards denominated in `rewardsToken()`
  function totalVestedAt(
    uint256 start,
    uint256 end,
    uint256 time,
    uint256 grantedAmount
  ) external pure returns (uint256 rewards) {
    return StakingRewardsVesting.totalVestedAt(start, end, time, grantedAmount);
  }

  /// @notice Number of rewards, in `rewardsToken().decimals()`, to disburse each second
  function rewardRate() internal view returns (uint256) {
    // The reward rate can be thought of as a piece-wise function:
    //
    //   let intervalStart = (maxRateAtPercent * targetCapacity),
    //       intervalEnd = (minRateAtPercent * targetCapacity),
    //       x = totalStakedSupply
    //   in
    //     if x < intervalStart
    //       y = maxRate
    //     if x > intervalEnd
    //       y = minRate
    //     else
    //       y = maxRate - (maxRate - minRate) * (x - intervalStart) / (intervalEnd - intervalStart)
    //
    // See an example here:
    // solhint-disable-next-line max-line-length
    // https://www.wolframalpha.com/input/?i=Piecewise%5B%7B%7B1000%2C+x+%3C+50%7D%2C+%7B100%2C+x+%3E+300%7D%2C+%7B1000+-+%281000+-+100%29+*+%28x+-+50%29+%2F+%28300+-+50%29+%2C+50+%3C+x+%3C+300%7D%7D%5D
    //
    // In that example:
    //   maxRateAtPercent = 0.5, minRateAtPercent = 3, targetCapacity = 100, maxRate = 1000, minRate = 100
    uint256 intervalStart = targetCapacity.mul(maxRateAtPercent).div(MULTIPLIER_DECIMALS);
    uint256 intervalEnd = targetCapacity.mul(minRateAtPercent).div(MULTIPLIER_DECIMALS);
    uint256 x = totalStakedSupply;

    // Subsequent computation would overflow
    if (intervalEnd <= intervalStart) {
      return 0;
    }

    if (x < intervalStart) {
      return maxRate;
    }

    if (x > intervalEnd) {
      return minRate;
    }

    return maxRate.sub(maxRate.sub(minRate).mul(x.sub(intervalStart)).div(intervalEnd.sub(intervalStart)));
  }

  function _positionToEffectiveAmount(StakedPosition storage position) internal view returns (uint256) {
    return toEffectiveAmount(position.amount, position.baseTokenExchangeRate, position.effectiveMultiplier);
  }

  function toEffectiveAmount(
    uint256 amount,
    uint256 baseTokenExchangeRate,
    uint256 effectiveMultiplier
  ) internal pure returns (uint256) {
    // Staked positions prior to GIP-1 do not have a baseTokenExchangeRate, so default to 1.
    uint256 exchangeRate = baseTokenExchangeRate == 0 ? MULTIPLIER_DECIMALS : baseTokenExchangeRate;
    // Both the exchange rate and the effective multiplier are denominated in MULTIPLIER_DECIMALS
    return amount.mul(exchangeRate).mul(effectiveMultiplier).div(MULTIPLIER_DECIMALS).div(MULTIPLIER_DECIMALS);
  }

  function stakingTokenMantissa() internal view returns (uint256) {
    return uint256(10)**baseStakingToken().decimals();
  }

  /// @notice The amount of rewards currently being earned per token per second. This amount takes into
  ///   account how many rewards are actually available for disbursal -- unlike `rewardRate()` which does not.
  ///   This function is intended for public consumption, to know the rate at which rewards are being
  ///   earned, and not as an input to the mutative calculations in this contract.
  /// @return Amount of rewards denominated in `rewardsToken().decimals()`.
  function currentEarnRatePerToken() public view returns (uint256) {
    uint256 time = block.timestamp == lastUpdateTime ? block.timestamp + 1 : block.timestamp;
    uint256 elapsed = time.sub(lastUpdateTime);
    return _additionalRewardsPerTokenSinceLastUpdate(time).div(elapsed);
  }

  /// @notice The amount of rewards currently being earned per second, for a given position. This function
  ///   is intended for public consumption, to know the rate at which rewards are being earned
  ///   for a given position, and not as an input to the mutative calculations in this contract.
  /// @return Amount of rewards denominated in `rewardsToken().decimals()`.
  function positionCurrentEarnRate(uint256 tokenId) external view returns (uint256) {
    return currentEarnRatePerToken().mul(_positionToEffectiveAmount(positions[tokenId])).div(stakingTokenMantissa());
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  /// @notice Stake `stakingToken()` to earn rewards. When you call this function, you'll receive an
  ///   an NFT representing your staked position. You can present your NFT to `getReward` or `unstake`
  ///   to claim rewards or unstake your tokens respectively. Rewards vest over a schedule.
  /// @dev This function checkpoints rewards.
  /// @param amount The amount of `stakingToken()` to stake
  /// @param positionType The type of the staked position
  function stake(uint256 amount, StakedPositionType positionType) external nonReentrant whenNotPaused updateReward(0) {
    _stake(msg.sender, msg.sender, amount, positionType);
  }

  /// @notice Deposit to SeniorPool and stake your shares in the same transaction.
  /// @param usdcAmount The amount of USDC to deposit into the senior pool. All shares from deposit
  ///   will be staked.
  function depositAndStake(uint256 usdcAmount) public nonReentrant whenNotPaused updateReward(0) {
    require(isGoListed(), "GL");
    IERC20withDec usdc = config.getUSDC();
    usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

    ISeniorPool seniorPool = config.getSeniorPool();
    usdc.safeIncreaseAllowance(address(seniorPool), usdcAmount);
    uint256 fiduAmount = seniorPool.deposit(usdcAmount);

    uint256 tokenId = _stake(address(this), msg.sender, fiduAmount, StakedPositionType.Fidu);
    emit DepositedAndStaked(msg.sender, usdcAmount, tokenId, fiduAmount);
  }

  /// @notice Identical to `depositAndStake`, except it allows for a signature to be passed that permits
  ///   this contract to move funds on behalf of the user.
  /// @param usdcAmount The amount of USDC to deposit
  /// @param v secp256k1 signature component
  /// @param r secp256k1 signature component
  /// @param s secp256k1 signature component
  function depositWithPermitAndStake(
    uint256 usdcAmount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), usdcAmount, deadline, v, r, s);
    depositAndStake(usdcAmount);
  }

  function depositToCurveAndStake(uint256 fiduAmount, uint256 usdcAmount) external {
    depositToCurveAndStakeFrom(msg.sender, fiduAmount, usdcAmount);
  }

  /// @notice Deposit to FIDU and USDC into the Curve LP, and stake your Curve LP tokens in the same transaction.
  /// @param fiduAmount The amount of FIDU to deposit
  /// @param usdcAmount The amount of USDC to deposit
  function depositToCurveAndStakeFrom(
    address nftRecipient,
    uint256 fiduAmount,
    uint256 usdcAmount
  ) public nonReentrant whenNotPaused updateReward(0) {
    require(fiduAmount > 0 || usdcAmount > 0, "ZERO");

    IERC20withDec usdc = config.getUSDC();
    IERC20withDec fidu = config.getFidu();
    ICurveLP curveLP = config.getFiduUSDCCurveLP();

    // Transfer FIDU and USDC from staker to StakingRewards, and allow the Curve LP contract to spend
    // this contract's FIDU and USDC
    if (fiduAmount > 0) {
      fidu.safeTransferFrom(msg.sender, address(this), fiduAmount);
      fidu.safeIncreaseAllowance(address(curveLP), fiduAmount);
    }
    if (usdcAmount > 0) {
      usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
      usdc.safeIncreaseAllowance(address(curveLP), usdcAmount);
    }

    // Calculate the expected number of Curve LP tokens to receive
    uint256 expectedAmount = curveLP.calcTokenAmount([fiduAmount, usdcAmount], true);

    // Add liquidity to Curve. The Curve LP tokens will be minted under StakingRewards
    uint256 curveLPTokens = curveLP.addLiquidity([fiduAmount, usdcAmount], expectedAmount, address(this));

    // Stake the Curve LP tokens on behalf of the user
    uint256 tokenId = _stake(address(this), nftRecipient, curveLPTokens, StakedPositionType.CurveLP);

    emit DepositedToCurveAndStaked(msg.sender, fiduAmount, usdcAmount, tokenId, curveLPTokens);
  }

  /// @notice The effective multiplier used to denominate a staked position type in `baseStakingToken()`.
  ///   The multiplier is represented in `MULTIPLIER_DECIMALS`
  function getEffectiveMultiplier(StakedPositionType positionType) public view returns (uint256) {
    if (effectiveMultipliers[positionType] > 0) {
      return effectiveMultipliers[positionType];
    }

    return MULTIPLIER_DECIMALS; // 1x
  }

  /// @notice Calculate the exchange rate that will be used to convert the original staked token amount to the
  ///   `baseStakingToken()` amount. The exchange rate is denominated in `MULTIPLIER_DECIMALS`.
  /// @param positionType Type of the staked postion
  function getBaseTokenExchangeRate(StakedPositionType positionType) public view virtual returns (uint256) {
    if (positionType == StakedPositionType.CurveLP) {
      // Curve LP tokens are scaled by MULTIPLIER_DECIMALS (1e18),
      uint256 curveLPVirtualPrice = config.getFiduUSDCCurveLP().getVirtualPrice();
      // The FIDU token price is also scaled by MULTIPLIER_DECIMALS (1e18)
      uint256 fiduPrice = config.getSeniorPool().sharePrice();
      return curveLPVirtualPrice.mul(MULTIPLIER_DECIMALS).div(fiduPrice);
    }

    return MULTIPLIER_DECIMALS; // 1x
  }

  function _stake(
    address staker,
    address nftRecipient,
    uint256 amount,
    StakedPositionType positionType
  ) internal returns (uint256 tokenId) {
    require(amount > 0, "ZERO");

    _tokenIdTracker.increment();
    tokenId = _tokenIdTracker.current();

    // Ensure we snapshot accumulatedRewardsPerToken for tokenId after it is available
    // We do this before setting the position, because we don't want `earned` to (incorrectly) account for
    // position.amount yet. This is equivalent to using the updateReward(msg.sender) modifier in the original
    // synthetix contract, where the modifier is called before any staking balance for that address is recorded
    _updateReward(tokenId);

    uint256 baseTokenExchangeRate = getBaseTokenExchangeRate(positionType);
    uint256 effectiveMultiplier = getEffectiveMultiplier(positionType);

    positions[tokenId] = StakedPosition({
      positionType: positionType,
      amount: amount,
      rewards: StakingRewardsVesting.Rewards({
        totalUnvested: 0,
        totalVested: 0,
        totalPreviouslyVested: 0,
        totalClaimed: 0,
        startTime: block.timestamp,
        endTime: block.timestamp.add(vestingLength)
      }),
      baseTokenExchangeRate: baseTokenExchangeRate,
      effectiveMultiplier: effectiveMultiplier,
      leverageMultiplier: 0,
      lockedUntil: 0
    });
    _mint(nftRecipient, tokenId);

    uint256 effectiveAmount = _positionToEffectiveAmount(positions[tokenId]);
    totalStakedSupply = totalStakedSupply.add(effectiveAmount);

    // Staker is address(this) when using depositAndStake or other convenience functions
    if (staker != address(this)) {
      stakingToken(positionType).safeTransferFrom(staker, address(this), amount);
    }

    emit Staked(nftRecipient, tokenId, amount, positionType, baseTokenExchangeRate);

    return tokenId;
  }

  /// @notice Unstake an amount of `stakingToken()` associated with a given position and transfer to msg.sender.
  ///   Unvested rewards will be forfeited, but remaining staked amount will continue to accrue rewards.
  ///   Positions that are still locked cannot be unstaked until the position's lockedUntil time has passed.
  /// @dev This function checkpoints rewards
  /// @param tokenId A staking position token ID
  /// @param amount Amount of `stakingToken()` to be unstaked from the position
  function unstake(uint256 tokenId, uint256 amount) public nonReentrant whenNotPaused updateReward(tokenId) {
    StakedPositionType positionType = positions[tokenId].positionType;
    _unstake(tokenId, amount);
    stakingToken(positionType).safeTransfer(msg.sender, amount);
  }

  /// @notice Unstake multiple positions and transfer to msg.sender.
  ///
  /// @dev This function checkpoints rewards
  /// @param tokenIds A list of position token IDs
  /// @param amounts A list of amounts of `stakingToken()` to be unstaked from the position
  function unstakeMultiple(uint256[] calldata tokenIds, uint256[] calldata amounts)
    external
    nonReentrant
    whenNotPaused
  {
    require(tokenIds.length == amounts.length, "LEN");

    uint256 fiduAmountToUnstake = 0;
    uint256 curveAmountToUnstake = 0;

    for (uint256 i = 0; i < amounts.length; i++) {
      StakedPositionType positionType = positions[tokenIds[i]].positionType;
      _unstake(tokenIds[i], amounts[i]);
      if (positionType == StakedPositionType.CurveLP) {
        curveAmountToUnstake = curveAmountToUnstake.add(amounts[i]);
      } else {
        fiduAmountToUnstake = fiduAmountToUnstake.add(amounts[i]);
      }
    }

    if (fiduAmountToUnstake > 0) {
      stakingToken(StakedPositionType.Fidu).safeTransfer(msg.sender, fiduAmountToUnstake);
    }
    if (curveAmountToUnstake > 0) {
      stakingToken(StakedPositionType.CurveLP).safeTransfer(msg.sender, curveAmountToUnstake);
    }

    emit UnstakedMultiple(msg.sender, tokenIds, amounts);
  }

  function unstakeAndWithdraw(uint256 tokenId, uint256 usdcAmount) external nonReentrant whenNotPaused {
    (uint256 usdcReceivedAmount, uint256 fiduAmount) = _unstakeAndWithdraw(tokenId, usdcAmount);

    emit UnstakedAndWithdrew(msg.sender, usdcReceivedAmount, tokenId, fiduAmount);
  }

  function _unstakeAndWithdraw(uint256 tokenId, uint256 usdcAmount)
    internal
    updateReward(tokenId)
    returns (uint256 usdcAmountReceived, uint256 fiduUsed)
  {
    require(canWithdraw(tokenId), "CW");
    require(isGoListed(), "GL");
    ISeniorPool seniorPool = config.getSeniorPool();
    IFidu fidu = config.getFidu();

    uint256 fiduBalanceBefore = fidu.balanceOf(address(this));

    usdcAmountReceived = seniorPool.withdraw(usdcAmount);

    fiduUsed = fiduBalanceBefore.sub(fidu.balanceOf(address(this)));

    _unstake(tokenId, fiduUsed);
    config.getUSDC().safeTransfer(msg.sender, usdcAmountReceived);

    return (usdcAmountReceived, fiduUsed);
  }

  function unstakeAndWithdrawMultiple(uint256[] calldata tokenIds, uint256[] calldata usdcAmounts)
    external
    nonReentrant
    whenNotPaused
  {
    require(tokenIds.length == usdcAmounts.length, "LEN");

    uint256 usdcReceivedAmountTotal = 0;
    uint256[] memory fiduAmounts = new uint256[](usdcAmounts.length);
    for (uint256 i = 0; i < usdcAmounts.length; i++) {
      (uint256 usdcReceivedAmount, uint256 fiduAmount) = _unstakeAndWithdraw(tokenIds[i], usdcAmounts[i]);

      usdcReceivedAmountTotal = usdcReceivedAmountTotal.add(usdcReceivedAmount);
      fiduAmounts[i] = fiduAmount;
    }

    emit UnstakedAndWithdrewMultiple(msg.sender, usdcReceivedAmountTotal, tokenIds, fiduAmounts);
  }

  function unstakeAndWithdrawInFidu(uint256 tokenId, uint256 fiduAmount) public nonReentrant whenNotPaused {
    uint256 usdcReceivedAmount = _unstakeAndWithdrawInFidu(tokenId, fiduAmount);

    emit UnstakedAndWithdrew(msg.sender, usdcReceivedAmount, tokenId, fiduAmount);
  }

  function _unstakeAndWithdrawInFidu(uint256 tokenId, uint256 fiduAmount)
    internal
    updateReward(tokenId)
    returns (uint256 usdcReceivedAmount)
  {
    require(canWithdraw(tokenId), "CW");

    usdcReceivedAmount = config.getSeniorPool().withdrawInFidu(fiduAmount);
    _unstake(tokenId, fiduAmount);
    config.getUSDC().safeTransfer(msg.sender, usdcReceivedAmount);
    return usdcReceivedAmount;
  }

  function unstakeAndWithdrawMultipleInFidu(uint256[] calldata tokenIds, uint256[] calldata fiduAmounts)
    external
    nonReentrant
    whenNotPaused
  {
    require(tokenIds.length == fiduAmounts.length, "LEN");

    uint256 usdcReceivedAmountTotal = 0;
    for (uint256 i = 0; i < fiduAmounts.length; i++) {
      uint256 usdcReceivedAmount = _unstakeAndWithdrawInFidu(tokenIds[i], fiduAmounts[i]);

      usdcReceivedAmountTotal = usdcReceivedAmountTotal.add(usdcReceivedAmount);
    }

    emit UnstakedAndWithdrewMultiple(msg.sender, usdcReceivedAmountTotal, tokenIds, fiduAmounts);
  }

  function _unstake(uint256 tokenId, uint256 amount) internal {
    require(ownerOf(tokenId) == msg.sender || isZapper(), "AD");
    require(amount > 0, "ZERO");

    StakedPosition storage position = positions[tokenId];
    uint256 prevAmount = position.amount;
    require(amount <= prevAmount, "cannot unstake more than balance");

    require(block.timestamp >= position.lockedUntil, "LOCKED");

    uint256 effectiveAmount = toEffectiveAmount(amount, position.baseTokenExchangeRate, position.effectiveMultiplier);
    totalStakedSupply = totalStakedSupply.sub(effectiveAmount);
    position.amount = prevAmount.sub(amount);

    // Slash unvested rewards
    if (!isZapper()) {
      uint256 slashingPercentage = amount.mul(StakingRewardsVesting.PERCENTAGE_DECIMALS).div(prevAmount);
      position.rewards.slash(slashingPercentage);
    }

    emit Unstaked(msg.sender, tokenId, amount, position.positionType);
  }

  /// @notice "Kick" a user's reward multiplier. If they are past their lock-up period, their reward
  ///   multipler will be reset to 1x.
  /// @dev This will also checkpoint their rewards up to the current time.
  // solhint-disable-next-line no-empty-blocks
  function kick(uint256 tokenId) public nonReentrant whenNotPaused updateReward(tokenId) {}

  /// @notice Updates a user's effective multiplier to the prevailing multiplier. This function gives
  ///   users an option to get on a higher multiplier without needing to unstake and lose their unvested tokens.
  /// @dev This will also checkpoint their rewards up to the current time.
  function updatePositionEffectiveMultiplier(uint256 tokenId)
    external
    nonReentrant
    whenNotPaused
    updateReward(tokenId)
  {
    require(ownerOf(tokenId) == msg.sender, "AD");

    StakedPosition storage position = positions[tokenId];

    uint256 newEffectiveMultiplier = getEffectiveMultiplier(position.positionType);

    // Prevent a user from accidentally lowering their effective multiplier
    require(newEffectiveMultiplier >= position.effectiveMultiplier, "cannot update position");

    uint256 prevEffectiveAmount = _positionToEffectiveAmount(position);

    position.effectiveMultiplier = newEffectiveMultiplier;

    uint256 newEffectiveAmount = _positionToEffectiveAmount(position);

    totalStakedSupply = totalStakedSupply.sub(prevEffectiveAmount).add(newEffectiveAmount);
  }

  /// @notice Claim rewards for a given staked position
  /// @param tokenId A staking position token ID
  function getReward(uint256 tokenId) public nonReentrant whenNotPaused updateReward(tokenId) {
    require(ownerOf(tokenId) == msg.sender, "AD");
    uint256 reward = claimableRewards(tokenId);
    if (reward > 0) {
      positions[tokenId].rewards.claim(reward);
      rewardsToken().safeTransfer(msg.sender, reward);
      emit RewardPaid(msg.sender, tokenId, reward);
    }
  }

  /// @notice Unstake the position's full amount and claim all rewards
  /// @param tokenId A staking position token ID
  function exit(uint256 tokenId) external {
    unstake(tokenId, positions[tokenId].amount);
    getReward(tokenId);
  }

  function exitAndWithdraw(uint256 tokenId) external {
    unstakeAndWithdrawInFidu(tokenId, positions[tokenId].amount);
    getReward(tokenId);
  }

  function addToStake(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused updateReward(tokenId) {
    require(isZapper(), "AD");

    StakedPosition storage position = positions[tokenId];
    position.amount = position.amount.add(amount);

    totalStakedSupply = totalStakedSupply.add(amount);

    stakingToken(position.positionType).safeTransferFrom(msg.sender, address(this), amount);
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  /// @notice Transfer rewards from msg.sender, to be used for reward distribution
  function loadRewards(uint256 rewards) external onlyAdmin updateReward(0) {
    rewardsToken().safeTransferFrom(msg.sender, address(this), rewards);
    rewardsAvailable = rewardsAvailable.add(rewards);
    emit RewardAdded(rewards);
  }

  function setRewardsParameters(
    uint256 _targetCapacity,
    uint256 _minRate,
    uint256 _maxRate,
    uint256 _minRateAtPercent,
    uint256 _maxRateAtPercent
  ) external onlyAdmin updateReward(0) {
    require(_maxRate >= _minRate, "maxRate must be >= then minRate");
    require(_maxRateAtPercent <= _minRateAtPercent, "maxRateAtPercent must be <= minRateAtPercent");
    targetCapacity = _targetCapacity;
    minRate = _minRate;
    maxRate = _maxRate;
    minRateAtPercent = _minRateAtPercent;
    maxRateAtPercent = _maxRateAtPercent;

    emit RewardsParametersUpdated(msg.sender, targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent);
  }

  /// @notice Set the effective multiplier for a given staked position type. The effective multipler
  ///  is used to denominate a staked position to `baseStakingToken()`. The multiplier is represented in
  ///  `MULTIPLIER_DECIMALS`
  /// @param multiplier the new multiplier, denominated in `MULTIPLIER_DECIMALS`
  /// @param positionType the type of the position
  function setEffectiveMultiplier(uint256 multiplier, StakedPositionType positionType)
    external
    onlyAdmin
    updateReward(0)
  {
    effectiveMultipliers[positionType] = multiplier;
    emit EffectiveMultiplierUpdated(_msgSender(), positionType, multiplier);
  }

  function setVestingSchedule(uint256 _vestingLength) external onlyAdmin updateReward(0) {
    vestingLength = _vestingLength;
    emit VestingScheduleUpdated(msg.sender, vestingLength);
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
    emit GoldfinchConfigUpdated(_msgSender(), address(config));
  }

  /* ========== MODIFIERS ========== */

  modifier updateReward(uint256 tokenId) {
    _updateReward(tokenId);
    _;
  }

  function _updateReward(uint256 tokenId) internal {
    uint256 prevAccumulatedRewardsPerToken = accumulatedRewardsPerToken;

    accumulatedRewardsPerToken = rewardPerToken();
    uint256 rewardsJustDistributed = totalStakedSupply
      .mul(accumulatedRewardsPerToken.sub(prevAccumulatedRewardsPerToken))
      .div(stakingTokenMantissa());
    rewardsAvailable = rewardsAvailable.sub(rewardsJustDistributed);
    lastUpdateTime = block.timestamp;

    if (tokenId != 0) {
      uint256 additionalRewards = earnedSinceLastCheckpoint(tokenId);

      StakingRewardsVesting.Rewards storage rewards = positions[tokenId].rewards;
      rewards.totalUnvested = rewards.totalUnvested.add(additionalRewards);
      rewards.checkpoint();

      positionToAccumulatedRewardsPerToken[tokenId] = accumulatedRewardsPerToken;
    }
  }

  function isAdmin() internal view returns (bool) {
    return hasRole(OWNER_ROLE, _msgSender());
  }

  modifier onlyAdmin() {
    require(isAdmin(), "AD");
    _;
  }

  function isZapper() internal view returns (bool) {
    return hasRole(ZAPPER_ROLE, _msgSender());
  }

  function isGoListed() internal view returns (bool) {
    return config.getGo().goSeniorPool(msg.sender);
  }

  function canWithdraw(uint256 tokenId) internal view returns (bool) {
    return positions[tokenId].positionType == StakedPositionType.Fidu;
  }

  /* ========== EVENTS ========== */

  event RewardAdded(uint256 reward);
  event Staked(
    address indexed user,
    uint256 indexed tokenId,
    uint256 amount,
    StakedPositionType positionType,
    uint256 baseTokenExchangeRate
  );
  event DepositedAndStaked(address indexed user, uint256 depositedAmount, uint256 indexed tokenId, uint256 amount);
  event DepositedToCurveAndStaked(
    address indexed user,
    uint256 fiduAmount,
    uint256 usdcAmount,
    uint256 indexed tokenId,
    uint256 amount
  );
  event Unstaked(address indexed user, uint256 indexed tokenId, uint256 amount, StakedPositionType positionType);
  event UnstakedMultiple(address indexed user, uint256[] tokenIds, uint256[] amounts);
  event UnstakedAndWithdrew(address indexed user, uint256 usdcReceivedAmount, uint256 indexed tokenId, uint256 amount);
  event UnstakedAndWithdrewMultiple(
    address indexed user,
    uint256 usdcReceivedAmount,
    uint256[] tokenIds,
    uint256[] amounts
  );
  event RewardPaid(address indexed user, uint256 indexed tokenId, uint256 reward);
  event GoldfinchConfigUpdated(address indexed who, address configAddress);
}
