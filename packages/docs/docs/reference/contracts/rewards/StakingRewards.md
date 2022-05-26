## StakingRewards

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xFD6FF39DA508d281C2d255e9bBBfAb34B6be60c3

### LockupPeriod

```solidity
enum LockupPeriod {
  SixMonths,
  TwelveMonths,
  TwentyFourMonths
}
```

### StakedPositionType

```solidity
enum StakedPositionType {
  Fidu,
  CurveLP
}
```

### StakedPosition

```solidity
struct StakedPosition {
  uint256 amount;
  struct StakingRewardsVesting.Rewards rewards;
  uint256 leverageMultiplier;
  uint256 lockedUntil;
  enum StakingRewards.StakedPositionType positionType;
  uint256 unsafeEffectiveMultiplier;
  uint256 unsafeBaseTokenExchangeRate;
}
```

### RewardsParametersUpdated

```solidity
event RewardsParametersUpdated(address who, uint256 targetCapacity, uint256 minRate, uint256 maxRate, uint256 minRateAtPercent, uint256 maxRateAtPercent)
```

### TargetCapacityUpdated

```solidity
event TargetCapacityUpdated(address who, uint256 targetCapacity)
```

### VestingScheduleUpdated

```solidity
event VestingScheduleUpdated(address who, uint256 vestingLength)
```

### MinRateUpdated

```solidity
event MinRateUpdated(address who, uint256 minRate)
```

### MaxRateUpdated

```solidity
event MaxRateUpdated(address who, uint256 maxRate)
```

### MinRateAtPercentUpdated

```solidity
event MinRateAtPercentUpdated(address who, uint256 minRateAtPercent)
```

### MaxRateAtPercentUpdated

```solidity
event MaxRateAtPercentUpdated(address who, uint256 maxRateAtPercent)
```

### EffectiveMultiplierUpdated

```solidity
event EffectiveMultiplierUpdated(address who, enum StakingRewards.StakedPositionType positionType, uint256 multiplier)
```

### MULTIPLIER_DECIMALS

```solidity
uint256 MULTIPLIER_DECIMALS
```

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### ZAPPER_ROLE

```solidity
bytes32 ZAPPER_ROLE
```

### config

```solidity
contract GoldfinchConfig config
```

### lastUpdateTime

```solidity
uint256 lastUpdateTime
```

The block timestamp when rewards were last checkpointed

### accumulatedRewardsPerToken

```solidity
uint256 accumulatedRewardsPerToken
```

Accumulated rewards per token at the last checkpoint

### rewardsAvailable

```solidity
uint256 rewardsAvailable
```

Total rewards available for disbursement at the last checkpoint, denominated in &#x60;rewardsToken()&#x60;

### positionToAccumulatedRewardsPerToken

```solidity
mapping(uint256 &#x3D;&gt; uint256) positionToAccumulatedRewardsPerToken
```

StakedPosition tokenId &#x3D;&gt; accumulatedRewardsPerToken at the position&#x27;s last checkpoint

### targetCapacity

```solidity
uint256 targetCapacity
```

Desired supply of staked tokens. The reward rate adjusts in a range
  around this value to incentivize staking or unstaking to maintain it.

### minRate

```solidity
uint256 minRate
```

The minimum total disbursed rewards per second, denominated in &#x60;rewardsToken()&#x60;

### maxRate

```solidity
uint256 maxRate
```

The maximum total disbursed rewards per second, denominated in &#x60;rewardsToken()&#x60;

### maxRateAtPercent

```solidity
uint256 maxRateAtPercent
```

The percent of &#x60;targetCapacity&#x60; at which the reward rate reaches &#x60;maxRate&#x60;.
 Represented with &#x60;MULTIPLIER_DECIMALS&#x60;.

### minRateAtPercent

```solidity
uint256 minRateAtPercent
```

The percent of &#x60;targetCapacity&#x60; at which the reward rate reaches &#x60;minRate&#x60;.
 Represented with &#x60;MULTIPLIER_DECIMALS&#x60;.

### vestingLength

```solidity
uint256 vestingLength
```

The duration in seconds over which rewards vest

### totalStakedSupply

```solidity
uint256 totalStakedSupply
```

_Supply of staked tokens, denominated in &#x60;stakingToken().decimals()&#x60;
Note that due to the use of &#x60;unsafeBaseTokenExchangeRate&#x60; and &#x60;unsafeEffectiveMultiplier&#x60; on
a StakedPosition, the sum of &#x60;amount&#x60; across all staked positions will not necessarily
equal this &#x60;totalStakedSupply&#x60; value; the purpose of the base token exchange rate and
the effective multiplier is to enable calculation of an &quot;effective amount&quot; -- which is
what this &#x60;totalStakedSupply&#x60; represents the sum of._

### totalLeveragedStakedSupply

```solidity
uint256 totalLeveragedStakedSupply
```

_UNUSED (definition kept for storage slot)_

### leverageMultipliers

```solidity
mapping(enum StakingRewards.LockupPeriod &#x3D;&gt; uint256) leverageMultipliers
```

_UNUSED (definition kept for storage slot)_

### positions

```solidity
mapping(uint256 &#x3D;&gt; struct StakingRewards.StakedPosition) positions
```

_NFT tokenId &#x3D;&gt; staked position_

### effectiveMultipliers

```solidity
mapping(enum StakingRewards.StakedPositionType &#x3D;&gt; uint256) effectiveMultipliers
```

_A mapping of staked position types to multipliers used to denominate positions
  in &#x60;baseStakingToken()&#x60;. Represented with &#x60;MULTIPLIER_DECIMALS&#x60;._

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) external
```

### initZapperRole

```solidity
function initZapperRole() external
```

### stakedBalanceOf

```solidity
function stakedBalanceOf(uint256 tokenId) external view returns (uint256)
```

Returns the staked balance of a given position token.

_The value returned is the bare amount, not the effective amount. The bare amount represents
  the number of tokens the user has staked for a given position._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of staked tokens denominated in &#x60;stakingToken().decimals()&#x60; |

### rewardsToken

```solidity
function rewardsToken() internal view returns (contract IERC20withDec)
```

The address of the token being disbursed as rewards

### stakingToken

```solidity
function stakingToken(enum StakingRewards.StakedPositionType positionType) internal view returns (contract IERC20)
```

The address of the token that is staked for a given position type

### baseStakingToken

```solidity
function baseStakingToken() internal view returns (contract IERC20withDec)
```

The address of the base token used to denominate staking rewards

### _additionalRewardsPerTokenSinceLastUpdate

```solidity
function _additionalRewardsPerTokenSinceLastUpdate(uint256 time) internal view returns (uint256)
```

The additional rewards earned per token, between the provided time and the last
  time rewards were checkpointed, given the prevailing &#x60;rewardRate()&#x60;. This amount is limited
  by the amount of rewards that are available for distribution; if there aren&#x27;t enough
  rewards in the balance of this contract, then we shouldn&#x27;t be giving them out.

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in &#x60;rewardsToken().decimals()&#x60;. |

### rewardPerToken

```solidity
function rewardPerToken() public view returns (uint256)
```

Returns accumulated rewards per token up to the current block timestamp

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in &#x60;rewardsToken().decimals()&#x60; |

### earnedSinceLastCheckpoint

```solidity
function earnedSinceLastCheckpoint(uint256 tokenId) public view returns (uint256)
```

Returns rewards earned by a given position token from its last checkpoint up to the
  current block timestamp.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in &#x60;rewardsToken().decimals()&#x60; |

### totalOptimisticClaimable

```solidity
function totalOptimisticClaimable(address owner) external view returns (uint256)
```

### optimisticClaimable

```solidity
function optimisticClaimable(uint256 tokenId) public view returns (uint256)
```

### claimableRewards

```solidity
function claimableRewards(uint256 tokenId) public view returns (uint256 rewards)
```

Returns the rewards claimable by a given position token at the most recent checkpoint, taking into
  account vesting schedule.

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in &#x60;rewardsToken()&#x60; |

### totalVestedAt

```solidity
function totalVestedAt(uint256 start, uint256 end, uint256 time, uint256 grantedAmount) external pure returns (uint256 rewards)
```

Returns the rewards that will have vested for some position with the given params.

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in &#x60;rewardsToken()&#x60; |

### rewardRate

```solidity
function rewardRate() internal view returns (uint256)
```

Number of rewards, in &#x60;rewardsToken().decimals()&#x60;, to disburse each second

### _positionToEffectiveAmount

```solidity
function _positionToEffectiveAmount(struct StakingRewards.StakedPosition position) internal view returns (uint256)
```

### toEffectiveAmount

```solidity
function toEffectiveAmount(uint256 amount, uint256 safeBaseTokenExchangeRate, uint256 safeEffectiveMultiplier) internal pure returns (uint256)
```

Calculates the effective amount given the amount, (safe) base token exchange rate,
  and (safe) effective multiplier for a position

_Do NOT pass in the unsafeBaseTokenExchangeRate or unsafeEffectiveMultiplier in storage.
  Convert it to safe values using &#x60;safeBaseTokenExchangeRate()&#x60; and &#x60;safeEffectiveMultiplier()&#x60;_

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of staked tokens |
| safeBaseTokenExchangeRate | uint256 | The (safe) base token exchange rate. See @dev comment below. |
| safeEffectiveMultiplier | uint256 | The (safe) effective multiplier. See @dev comment below. |

### stakingAndRewardsTokenMantissa

```solidity
function stakingAndRewardsTokenMantissa() internal view returns (uint256)
```

_We overload the responsibility of this function -- i.e. returning a value that can be
used for both the &#x60;stakingToken()&#x60; mantissa and the &#x60;rewardsToken()&#x60; mantissa --, rather than have
multiple distinct functions for that purpose, in order to reduce contract size. We rely on a unit
test to ensure that the tokens&#x27; mantissas are indeed equal and therefore that this approach works._

### currentEarnRatePerToken

```solidity
function currentEarnRatePerToken() public view returns (uint256)
```

The amount of rewards currently being earned per token per second. This amount takes into
  account how many rewards are actually available for disbursal -- unlike &#x60;rewardRate()&#x60; which does not.
  This function is intended for public consumption, to know the rate at which rewards are being
  earned, and not as an input to the mutative calculations in this contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in &#x60;rewardsToken().decimals()&#x60;. |

### positionCurrentEarnRate

```solidity
function positionCurrentEarnRate(uint256 tokenId) external view returns (uint256)
```

The amount of rewards currently being earned per second, for a given position. This function
  is intended for public consumption, to know the rate at which rewards are being earned
  for a given position, and not as an input to the mutative calculations in this contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in &#x60;rewardsToken().decimals()&#x60;. |

### stake

```solidity
function stake(uint256 amount, enum StakingRewards.StakedPositionType positionType) external
```

Stake &#x60;stakingToken()&#x60; to earn rewards. When you call this function, you&#x27;ll receive an
  an NFT representing your staked position. You can present your NFT to &#x60;getReward&#x60; or &#x60;unstake&#x60;
  to claim rewards or unstake your tokens respectively. Rewards vest over a schedule.

_This function checkpoints rewards._

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of &#x60;stakingToken()&#x60; to stake |
| positionType | enum StakingRewards.StakedPositionType | The type of the staked position |

### depositAndStake

```solidity
function depositAndStake(uint256 usdcAmount) public
```

Deposit to SeniorPool and stake your shares in the same transaction.

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to deposit into the senior pool. All shares from deposit   will be staked. |

### depositWithPermitAndStake

```solidity
function depositWithPermitAndStake(uint256 usdcAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```

Identical to &#x60;depositAndStake&#x60;, except it allows for a signature to be passed that permits
  this contract to move funds on behalf of the user.

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to deposit |
| deadline | uint256 |  |
| v | uint8 | secp256k1 signature component |
| r | bytes32 | secp256k1 signature component |
| s | bytes32 | secp256k1 signature component |

### depositToCurve

```solidity
function depositToCurve(uint256 fiduAmount, uint256 usdcAmount) external
```

Deposits FIDU and USDC to Curve on behalf of the user. The Curve LP tokens will be minted
  directly to the user&#x27;s address

| Name | Type | Description |
| ---- | ---- | ----------- |
| fiduAmount | uint256 | The amount of FIDU to deposit |
| usdcAmount | uint256 | The amount of USDC to deposit |

### depositToCurveAndStake

```solidity
function depositToCurveAndStake(uint256 fiduAmount, uint256 usdcAmount) external
```

### depositToCurveAndStakeFrom

```solidity
function depositToCurveAndStakeFrom(address nftRecipient, uint256 fiduAmount, uint256 usdcAmount) public
```

Deposit to FIDU and USDC into the Curve LP, and stake your Curve LP tokens in the same transaction.

| Name | Type | Description |
| ---- | ---- | ----------- |
| nftRecipient | address |  |
| fiduAmount | uint256 | The amount of FIDU to deposit |
| usdcAmount | uint256 | The amount of USDC to deposit |

### _depositToCurve

```solidity
function _depositToCurve(address depositor, address lpTokensRecipient, uint256 fiduAmount, uint256 usdcAmount) internal returns (uint256)
```

Deposit to FIDU and USDC into the Curve LP. Returns the amount of Curve LP tokens minted,
  which is denominated in 1e18.

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | The address of the depositor (i.e. the current owner of the FIDU and USDC to deposit) |
| lpTokensRecipient | address | The receipient of the resulting LP tokens |
| fiduAmount | uint256 | The amount of FIDU to deposit |
| usdcAmount | uint256 | The amount of USDC to deposit |

### safeEffectiveMultiplier

```solidity
function safeEffectiveMultiplier(struct StakingRewards.StakedPosition position) internal view returns (uint256)
```

Returns the effective multiplier for a given position. Defaults to 1 for all staked
  positions created prior to GIP-1 (before the &#x60;unsafeEffectiveMultiplier&#x60; field was added).

_Always use this method to get the effective multiplier to ensure proper handling of
  old staked positions._

### safeBaseTokenExchangeRate

```solidity
function safeBaseTokenExchangeRate(struct StakingRewards.StakedPosition position) internal view returns (uint256)
```

Returns the base token exchange rate for a given position. Defaults to 1 for all staked
  positions created prior to GIP-1 (before the &#x60;unsafeBaseTokenExchangeRate&#x60; field was added).

_Always use this method to get the base token exchange rate to ensure proper handling of
  old staked positions._

### getEffectiveMultiplierForPositionType

```solidity
function getEffectiveMultiplierForPositionType(enum StakingRewards.StakedPositionType positionType) public view returns (uint256)
```

The effective multiplier to use with new staked positions of the provided &#x60;positionType&#x60;,
  for denominating them in terms of &#x60;baseStakingToken()&#x60;. This value is denominated in &#x60;MULTIPLIER_DECIMALS&#x60;.

### getBaseTokenExchangeRate

```solidity
function getBaseTokenExchangeRate(enum StakingRewards.StakedPositionType positionType) public view virtual returns (uint256)
```

Calculate the exchange rate that will be used to convert the original staked token amount to the
  &#x60;baseStakingToken()&#x60; amount. The exchange rate is denominated in &#x60;MULTIPLIER_DECIMALS&#x60;.

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionType | enum StakingRewards.StakedPositionType | Type of the staked postion |

### _stake

```solidity
function _stake(address staker, address nftRecipient, uint256 amount, enum StakingRewards.StakedPositionType positionType) internal returns (uint256 tokenId)
```

### unstake

```solidity
function unstake(uint256 tokenId, uint256 amount) public
```

Unstake an amount of &#x60;stakingToken()&#x60; associated with a given position and transfer to msg.sender.
  Unvested rewards will be forfeited, but remaining staked amount will continue to accrue rewards.
  Positions that are still locked cannot be unstaked until the position&#x27;s lockedUntil time has passed.

_This function checkpoints rewards_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| amount | uint256 | Amount of &#x60;stakingToken()&#x60; to be unstaked from the position |

### unstakeMultiple

```solidity
function unstakeMultiple(uint256[] tokenIds, uint256[] amounts) external
```

Unstake multiple positions and transfer to msg.sender.

_This function checkpoints rewards_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | A list of position token IDs |
| amounts | uint256[] | A list of amounts of &#x60;stakingToken()&#x60; to be unstaked from the position |

### unstakeAndWithdraw

```solidity
function unstakeAndWithdraw(uint256 tokenId, uint256 usdcAmount) external
```

### _unstakeAndWithdraw

```solidity
function _unstakeAndWithdraw(uint256 tokenId, uint256 usdcAmount) internal returns (uint256 usdcAmountReceived, uint256 fiduUsed)
```

### unstakeAndWithdrawMultiple

```solidity
function unstakeAndWithdrawMultiple(uint256[] tokenIds, uint256[] usdcAmounts) external
```

### unstakeAndWithdrawInFidu

```solidity
function unstakeAndWithdrawInFidu(uint256 tokenId, uint256 fiduAmount) external
```

### _unstakeAndWithdrawInFidu

```solidity
function _unstakeAndWithdrawInFidu(uint256 tokenId, uint256 fiduAmount) internal returns (uint256 usdcReceivedAmount)
```

### unstakeAndWithdrawMultipleInFidu

```solidity
function unstakeAndWithdrawMultipleInFidu(uint256[] tokenIds, uint256[] fiduAmounts) external
```

### _unstake

```solidity
function _unstake(uint256 tokenId, uint256 amount) internal
```

### kick

```solidity
function kick(uint256 tokenId) external
```

&quot;Kick&quot; a user&#x27;s reward multiplier. If they are past their lock-up period, their reward
  multiplier will be reset to 1x.

_This will also checkpoint their rewards up to the current time._

### updatePositionEffectiveMultiplier

```solidity
function updatePositionEffectiveMultiplier(uint256 tokenId) external
```

Updates a user&#x27;s effective multiplier to the prevailing multiplier. This function gives
  users an option to get on a higher multiplier without needing to unstake and lose their unvested tokens.

_This will also checkpoint their rewards up to the current time._

### getReward

```solidity
function getReward(uint256 tokenId) public
```

Claim rewards for a given staked position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

### addToStake

```solidity
function addToStake(uint256 tokenId, uint256 amount) external
```

Add to an existing position without affecting vesting schedule

_This function checkpoints rewards and is only callable by an approved address with ZAPPER_ROLE. This
  function enables the Zapper to unwind &quot;in-progress&quot; positions initiated by &#x60;Zapper.zapStakeToTranchedPool&#x60;.
  That is, funds that were moved from this contract into a TranchedPool can be &quot;unwound&quot; back to their original
  staked position by the Zapper as part of &#x60;Zapper.unzapToStakingRewards&#x60;._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| amount | uint256 | Amount of &#x60;stakingToken()&#x60; to be added to tokenId&#x27;s position |

### loadRewards

```solidity
function loadRewards(uint256 rewards) external
```

Transfer rewards from msg.sender, to be used for reward distribution

### setRewardsParameters

```solidity
function setRewardsParameters(uint256 _targetCapacity, uint256 _minRate, uint256 _maxRate, uint256 _minRateAtPercent, uint256 _maxRateAtPercent) external
```

### setEffectiveMultiplier

```solidity
function setEffectiveMultiplier(uint256 multiplier, enum StakingRewards.StakedPositionType positionType) external
```

Set the effective multiplier for a given staked position type. The effective multipler
 is used to denominate a staked position to &#x60;baseStakingToken()&#x60;. The multiplier is represented in
 &#x60;MULTIPLIER_DECIMALS&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| multiplier | uint256 | the new multiplier, denominated in &#x60;MULTIPLIER_DECIMALS&#x60; |
| positionType | enum StakingRewards.StakedPositionType | the type of the position |

### setVestingSchedule

```solidity
function setVestingSchedule(uint256 _vestingLength) external
```

### updateReward

```solidity
modifier updateReward(uint256 tokenId)
```

### _updateReward

```solidity
function _updateReward(uint256 tokenId) internal
```

### isAdmin

```solidity
function isAdmin() internal view returns (bool)
```

### onlyAdmin

```solidity
modifier onlyAdmin()
```

### isZapper

```solidity
function isZapper() internal view returns (bool)
```

### isGoListed

```solidity
function isGoListed() internal view returns (bool)
```

### canWithdraw

```solidity
function canWithdraw(uint256 tokenId) internal view returns (bool)
```

### RewardAdded

```solidity
event RewardAdded(uint256 reward)
```

### Staked

```solidity
event Staked(address user, uint256 tokenId, uint256 amount, enum StakingRewards.StakedPositionType positionType, uint256 baseTokenExchangeRate)
```

### DepositedAndStaked

```solidity
event DepositedAndStaked(address user, uint256 depositedAmount, uint256 tokenId, uint256 amount)
```

### DepositedToCurve

```solidity
event DepositedToCurve(address user, uint256 fiduAmount, uint256 usdcAmount, uint256 tokensReceived)
```

### DepositedToCurveAndStaked

```solidity
event DepositedToCurveAndStaked(address user, uint256 fiduAmount, uint256 usdcAmount, uint256 tokenId, uint256 amount)
```

### Unstaked

```solidity
event Unstaked(address user, uint256 tokenId, uint256 amount, enum StakingRewards.StakedPositionType positionType)
```

### UnstakedMultiple

```solidity
event UnstakedMultiple(address user, uint256[] tokenIds, uint256[] amounts)
```

### UnstakedAndWithdrew

```solidity
event UnstakedAndWithdrew(address user, uint256 usdcReceivedAmount, uint256 tokenId, uint256 amount)
```

### UnstakedAndWithdrewMultiple

```solidity
event UnstakedAndWithdrewMultiple(address user, uint256 usdcReceivedAmount, uint256[] tokenIds, uint256[] amounts)
```

### RewardPaid

```solidity
event RewardPaid(address user, uint256 tokenId, uint256 reward)
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

