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

### MULTIPLIER_DECIMALS

```solidity
uint256 MULTIPLIER_DECIMALS
```

### USDC_MANTISSA

```solidity
uint256 USDC_MANTISSA
```

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
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

Total rewards available for disbursement at the last checkpoint, denominated in `rewardsToken()`

### positionToAccumulatedRewardsPerToken

```solidity
mapping(uint256 => uint256) positionToAccumulatedRewardsPerToken
```

StakedPosition tokenId => accumulatedRewardsPerToken at the position's last checkpoint

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

The minimum total disbursed rewards per second, denominated in `rewardsToken()`

### maxRate

```solidity
uint256 maxRate
```

The maximum total disbursed rewards per second, denominated in `rewardsToken()`

### maxRateAtPercent

```solidity
uint256 maxRateAtPercent
```

The percent of `targetCapacity` at which the reward rate reaches `maxRate`.
 Represented with `MULTIPLIER_DECIMALS`.

### minRateAtPercent

```solidity
uint256 minRateAtPercent
```

The percent of `targetCapacity` at which the reward rate reaches `minRate`.
 Represented with `MULTIPLIER_DECIMALS`.

### vestingLength

```solidity
uint256 vestingLength
```

The duration in seconds over which legacy rewards vest. New positions have no vesting
 and earn rewards immediately.

_UNUSED (definition kept for storage slot)_

### totalStakedSupply

```solidity
uint256 totalStakedSupply
```

_Supply of staked tokens, denominated in `stakingToken().decimals()`
Note that due to the use of `unsafeBaseTokenExchangeRate` and `unsafeEffectiveMultiplier` on
a StakedPosition, the sum of `amount` across all staked positions will not necessarily
equal this `totalStakedSupply` value; the purpose of the base token exchange rate and
the effective multiplier is to enable calculation of an "effective amount" -- which is
what this `totalStakedSupply` represents the sum of._

### totalLeveragedStakedSupply

```solidity
uint256 totalLeveragedStakedSupply
```

_UNUSED (definition kept for storage slot)_

### leverageMultipliers

```solidity
mapping(enum StakingRewards.LockupPeriod => uint256) leverageMultipliers
```

_UNUSED (definition kept for storage slot)_

### positions

```solidity
mapping(uint256 => struct StakedPosition) positions
```

_NFT tokenId => staked position_

### effectiveMultipliers

```solidity
mapping(enum StakedPositionType => uint256) effectiveMultipliers
```

_A mapping of staked position types to multipliers used to denominate positions
  in `baseStakingToken()`. Represented with `MULTIPLIER_DECIMALS`._

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) external
```

### getPosition

```solidity
function getPosition(uint256 tokenId) external view returns (struct StakedPosition position)
```

Get the staking rewards position

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | id of the position token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| position | struct StakedPosition | the position |

### stakedBalanceOf

```solidity
function stakedBalanceOf(uint256 tokenId) external view returns (uint256)
```

Returns the staked balance of a given position token.

_The value returned is the bare amount, not the effective amount. The bare amount represents
  the number of tokens the user has staked for a given position. The effective amount is the bare
  amount multiplied by the token's underlying asset type multiplier. This multiplier is a crypto-
  economic parameter determined by governance._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of staked tokens denominated in `stakingToken().decimals()` |

### rewardsToken

```solidity
function rewardsToken() internal view returns (contract IERC20withDec)
```

The address of the token being disbursed as rewards

### stakingToken

```solidity
function stakingToken(enum StakedPositionType positionType) internal view returns (contract IERC20)
```

The address of the token that is staked for a given position type

### _additionalRewardsPerTokenSinceLastUpdate

```solidity
function _additionalRewardsPerTokenSinceLastUpdate(uint256 time) internal view returns (uint256)
```

The additional rewards earned per token, between the provided time and the last
  time rewards were checkpointed, given the prevailing `rewardRate()`. This amount is limited
  by the amount of rewards that are available for distribution; if there aren't enough
  rewards in the balance of this contract, then we shouldn't be giving them out.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in `rewardsToken().decimals()`. |

### rewardPerToken

```solidity
function rewardPerToken() public view returns (uint256)
```

Returns accumulated rewards per token up to the current block timestamp

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in `rewardsToken().decimals()` |

### earnedSinceLastCheckpoint

```solidity
function earnedSinceLastCheckpoint(uint256 tokenId) public view returns (uint256)
```

Returns rewards earned by a given position token from its last checkpoint up to the
  current block timestamp.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in `rewardsToken().decimals()` |

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
  account vesting schedule for legacy positions.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in `rewardsToken()` |

### totalVestedAt

```solidity
function totalVestedAt(uint256 start, uint256 end, uint256 time, uint256 grantedAmount) external pure returns (uint256 rewards)
```

Returns the rewards that will have vested for some position with the given params.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in `rewardsToken()` |

### rewardRate

```solidity
function rewardRate() internal view returns (uint256)
```

Number of rewards, in `rewardsToken().decimals()`, to disburse each second

### _positionToEffectiveAmount

```solidity
function _positionToEffectiveAmount(struct StakedPosition position) internal view returns (uint256)
```

### toEffectiveAmount

```solidity
function toEffectiveAmount(uint256 amount, uint256 safeBaseTokenExchangeRate, uint256 safeEffectiveMultiplier) internal pure returns (uint256)
```

Calculates the effective amount given the amount, (safe) base token exchange rate,
  and (safe) effective multiplier for a position

_Do NOT pass in the unsafeBaseTokenExchangeRate or unsafeEffectiveMultiplier in storage.
  Convert it to safe values using `safeBaseTokenExchangeRate()` and `safeEffectiveMultiplier()`_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of staked tokens |
| safeBaseTokenExchangeRate | uint256 | The (safe) base token exchange rate. See @dev comment below. |
| safeEffectiveMultiplier | uint256 | The (safe) effective multiplier. See @dev comment below. |

### stakingAndRewardsTokenMantissa

```solidity
function stakingAndRewardsTokenMantissa() internal pure returns (uint256)
```

_We overload the responsibility of this function -- i.e. returning a value that can be
used for both the `stakingToken()` mantissa and the `rewardsToken()` mantissa --, rather than have
multiple distinct functions for that purpose, in order to reduce contract size. We rely on a unit
test to ensure that the tokens' mantissas are indeed 1e18 and therefore that this approach works._

### currentEarnRatePerToken

```solidity
function currentEarnRatePerToken() public view returns (uint256)
```

The amount of rewards currently being earned per token per second. This amount takes into
  account how many rewards are actually available for disbursal -- unlike `rewardRate()` which does not.
  This function is intended for public consumption, to know the rate at which rewards are being
  earned, and not as an input to the mutative calculations in this contract.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in `rewardsToken().decimals()`. |

### positionCurrentEarnRate

```solidity
function positionCurrentEarnRate(uint256 tokenId) external view returns (uint256)
```

The amount of rewards currently being earned per second, for a given position. This function
  is intended for public consumption, to know the rate at which rewards are being earned
  for a given position, and not as an input to the mutative calculations in this contract.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of rewards denominated in `rewardsToken().decimals()`. |

### setBaseURI

```solidity
function setBaseURI(string baseURI_) external
```

### stake

```solidity
function stake(uint256 amount, enum StakedPositionType positionType) external returns (uint256)
```

Stake `stakingToken()` to earn rewards. When you call this function, you'll receive an
  an NFT representing your staked position. You can present your NFT to `getReward` or `unstake`
  to claim rewards or unstake your tokens respectively.

_This function checkpoints rewards._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of `stakingToken()` to stake |
| positionType | enum StakedPositionType | The type of the staked position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Id of the NFT representing the staked position |

### depositAndStake

```solidity
function depositAndStake(uint256 usdcAmount) public returns (uint256)
```

Deposit to SeniorPool and stake your shares in the same transaction.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to deposit into the senior pool. All shares from deposit   will be staked. |

### depositWithPermitAndStake

```solidity
function depositWithPermitAndStake(uint256 usdcAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256)
```

Identical to `depositAndStake`, except it allows for a signature to be passed that permits
  this contract to move funds on behalf of the user.

#### Parameters

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
  directly to the user's address

#### Parameters

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

#### Parameters

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

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | The address of the depositor (i.e. the current owner of the FIDU and USDC to deposit) |
| lpTokensRecipient | address | The receipient of the resulting LP tokens |
| fiduAmount | uint256 | The amount of FIDU to deposit |
| usdcAmount | uint256 | The amount of USDC to deposit |

### safeEffectiveMultiplier

```solidity
function safeEffectiveMultiplier(struct StakedPosition position) internal view returns (uint256)
```

Returns the effective multiplier for a given position. Defaults to 1 for all staked
  positions created prior to GIP-1 (before the `unsafeEffectiveMultiplier` field was added).

_Always use this method to get the effective multiplier to ensure proper handling of
  old staked positions._

### safeBaseTokenExchangeRate

```solidity
function safeBaseTokenExchangeRate(struct StakedPosition position) internal view returns (uint256)
```

Returns the base token exchange rate for a given position. Defaults to 1 for all staked
  positions created prior to GIP-1 (before the `unsafeBaseTokenExchangeRate` field was added).

_Always use this method to get the base token exchange rate to ensure proper handling of
  old staked positions._

### getEffectiveMultiplierForPositionType

```solidity
function getEffectiveMultiplierForPositionType(enum StakedPositionType positionType) public view returns (uint256)
```

The effective multiplier to use with new staked positions of the provided `positionType`,
  for denominating them in terms of `baseStakingToken()`. This value is denominated in `MULTIPLIER_DECIMALS`.

### getBaseTokenExchangeRate

```solidity
function getBaseTokenExchangeRate(enum StakedPositionType positionType) public view virtual returns (uint256)
```

Calculate the exchange rate that will be used to convert the original staked token amount to the
  `baseStakingToken()` amount. The exchange rate is denominated in `MULTIPLIER_DECIMALS`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionType | enum StakedPositionType | Type of the staked postion |

### _stake

```solidity
function _stake(address staker, address nftRecipient, uint256 amount, enum StakedPositionType positionType) internal returns (uint256 tokenId)
```

### unstake

```solidity
function unstake(uint256 tokenId, uint256 amount) public
```

Unstake an amount of `stakingToken()` (FIDU, FiduUSDCCurveLP, etc) associated with
  a given position and transfer to msg.sender. Any remaining staked amount will continue to
  accrue rewards.

_This function checkpoints rewards_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| amount | uint256 | Amount of `stakingToken()` to be unstaked from the position |

### unstakeMultiple

```solidity
function unstakeMultiple(uint256[] tokenIds, uint256[] amounts) external
```

Unstake multiple positions and transfer to msg.sender.

_This function checkpoints rewards_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | A list of position token IDs |
| amounts | uint256[] | A list of amounts of `stakingToken()` to be unstaked from the position |

### _unstake

```solidity
function _unstake(uint256 tokenId, uint256 amount) internal
```

Unstake an amount from a single position

_This function does NOT checkpoint rewards; the caller of this function is responsible
  for ensuring that rewards are properly checkpointed before invocation.
This function does NOT transfer staked tokens back to the user; the caller of this
  function is responsible for ensuring that tokens are transferred back to the
  owner if necessary._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID |
| amount | uint256 | The amount of of `stakingToken()` to be unstaked from the position |

### kick

```solidity
function kick(uint256 tokenId) external
```

"Kick" a user's reward multiplier. If they are past their lock-up period, their reward
  multiplier will be reset to 1x.

_This will also checkpoint their rewards up to the current time._

### updatePositionEffectiveMultiplier

```solidity
function updatePositionEffectiveMultiplier(uint256 tokenId) external
```

Updates a user's effective multiplier to the prevailing multiplier. This function gives
  users an option to get on a higher multiplier without needing to unstake.

_This will also checkpoint their rewards up to the current time._

### getReward

```solidity
function getReward(uint256 tokenId) external returns (uint256)
```

Claim rewards for a given staked position

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of rewards claimed |

### addToStake

```solidity
function addToStake(uint256 tokenId, uint256 amount) external
```

Add `amount` to an existing FIDU position (`tokenId`)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| amount | uint256 | Amount of `stakingToken()` to be added to tokenId's position |

### loadRewards

```solidity
function loadRewards(uint256 rewards) external
```

Transfer rewards from msg.sender, to be used for reward distribution

### removeRewards

```solidity
function removeRewards(uint256 amount) external
```

Transfer rewards from staking rewards, to the caller

### setRewardsParameters

```solidity
function setRewardsParameters(uint256 _targetCapacity, uint256 _minRate, uint256 _maxRate, uint256 _minRateAtPercent, uint256 _maxRateAtPercent) external
```

### setEffectiveMultiplier

```solidity
function setEffectiveMultiplier(uint256 multiplier, enum StakedPositionType positionType) external
```

Set the effective multiplier for a given staked position type. The effective multipler
 is used to denominate a staked position to `baseStakingToken()`. The multiplier is represented in
 `MULTIPLIER_DECIMALS`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| multiplier | uint256 | the new multiplier, denominated in `MULTIPLIER_DECIMALS` |
| positionType | enum StakedPositionType | the type of the position |

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

### isGoListed

```solidity
function isGoListed() internal view returns (bool)
```

### canWithdraw

```solidity
function canWithdraw(uint256 tokenId) internal view returns (bool)
```

