## BackerRewards

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x384860F14B39CcD9C89A73519c70cD5f5394D0a6

### config

```solidity
contract GoldfinchConfig config
```

### GFI_MANTISSA

```solidity
uint256 GFI_MANTISSA
```

### FIDU_MANTISSA

```solidity
uint256 FIDU_MANTISSA
```

### USDC_MANTISSA

```solidity
uint256 USDC_MANTISSA
```

### NUM_TRANCHES_PER_SLICE

```solidity
uint256 NUM_TRANCHES_PER_SLICE
```

### BackerRewardsInfo

```solidity
struct BackerRewardsInfo {
  uint256 accRewardsPerPrincipalDollar;
}
```

### BackerRewardsTokenInfo

```solidity
struct BackerRewardsTokenInfo {
  uint256 rewardsClaimed;
  uint256 accRewardsPerPrincipalDollarAtMint;
}
```

### StakingRewardsPoolInfo

```solidity
struct StakingRewardsPoolInfo {
  uint256 accumulatedRewardsPerTokenAtLastCheckpoint;
  uint256 lastUpdateTime;
  struct BackerRewards.StakingRewardsSliceInfo[] slicesInfo;
}
```

### StakingRewardsSliceInfo

```solidity
struct StakingRewardsSliceInfo {
  uint256 fiduSharePriceAtDrawdown;
  uint256 principalDeployedAtLastCheckpoint;
  uint256 accumulatedRewardsPerTokenAtDrawdown;
  uint256 accumulatedRewardsPerTokenAtLastCheckpoint;
  uint256 unrealizedAccumulatedRewardsPerTokenAtLastCheckpoint;
}
```

### StakingRewardsTokenInfo

```solidity
struct StakingRewardsTokenInfo {
  uint256 accumulatedRewardsPerTokenAtLastWithdraw;
}
```

### totalRewards

```solidity
uint256 totalRewards
```

total amount of GFI rewards available, times 1e18

### maxInterestDollarsEligible

```solidity
uint256 maxInterestDollarsEligible
```

interest $ eligible for gfi rewards, times 1e18

### totalInterestReceived

```solidity
uint256 totalInterestReceived
```

counter of total interest repayments, times 1e6

### totalRewardPercentOfTotalGFI

```solidity
uint256 totalRewardPercentOfTotalGFI
```

totalRewards/totalGFISupply * 100, times 1e18

### tokens

```solidity
mapping(uint256 &#x3D;&gt; struct BackerRewards.BackerRewardsTokenInfo) tokens
```

poolTokenId -&gt; BackerRewardsTokenInfo

### pools

```solidity
mapping(address &#x3D;&gt; struct BackerRewards.BackerRewardsInfo) pools
```

pool.address -&gt; BackerRewardsInfo

### poolStakingRewards

```solidity
mapping(contract ITranchedPool &#x3D;&gt; struct BackerRewards.StakingRewardsPoolInfo) poolStakingRewards
```

Staking rewards info for each pool

### tokenStakingRewards

```solidity
mapping(uint256 &#x3D;&gt; struct BackerRewards.StakingRewardsTokenInfo) tokenStakingRewards
```

Staking rewards info for each pool token

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) public
```

### forceInitializeStakingRewardsPoolInfo

```solidity
function forceInitializeStakingRewardsPoolInfo(contract ITranchedPool pool, uint256 fiduSharePriceAtDrawdown, uint256 principalDeployedAtDrawdown, uint256 rewardsAccumulatorAtDrawdown) external
```

intialize the first slice of a StakingRewardsPoolInfo

_this is _only_ meant to be called on pools that didnt qualify for the backer rewards airdrop
      but were deployed before this contract._

### allocateRewards

```solidity
function allocateRewards(uint256 _interestPaymentAmount) external
```

Calculates the accRewardsPerPrincipalDollar for a given pool,
         when a interest payment is received by the protocol

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interestPaymentAmount | uint256 | The amount of total dollars the interest payment, expects 10^6 value |

### setTotalRewards

```solidity
function setTotalRewards(uint256 _totalRewards) public
```

Set the total gfi rewards and the % of total GFI

| Name | Type | Description |
| ---- | ---- | ----------- |
| _totalRewards | uint256 | The amount of GFI rewards available, expects 10^18 value |

### setTotalInterestReceived

```solidity
function setTotalInterestReceived(uint256 _totalInterestReceived) public
```

Set the total interest received to date.
This should only be called once on contract deploy.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _totalInterestReceived | uint256 | The amount of interest the protocol has received to date, expects 10^6 value |

### setMaxInterestDollarsEligible

```solidity
function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public
```

Set the max dollars across the entire protocol that are eligible for GFI rewards

| Name | Type | Description |
| ---- | ---- | ----------- |
| _maxInterestDollarsEligible | uint256 | The amount of interest dollars eligible for GFI rewards, expects 10^18 value |

### setPoolTokenAccRewardsPerPrincipalDollarAtMint

```solidity
function setPoolTokenAccRewardsPerPrincipalDollarAtMint(address poolAddress, uint256 tokenId) external
```

When a pool token is minted for multiple drawdowns,
 set accRewardsPerPrincipalDollarAtMint to the current accRewardsPerPrincipalDollar price

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address |  |
| tokenId | uint256 | Pool token id |

### onTranchedPoolDrawdown

```solidity
function onTranchedPoolDrawdown(uint256 sliceIndex) external
```

callback for TranchedPools when they drawdown

_initializes rewards info for the calling TranchedPool_

### poolTokenClaimableRewards

```solidity
function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256)
```

Calculate the gross available gfi rewards for a PoolToken

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of GFI claimable |

### stakingRewardsClaimed

```solidity
function stakingRewardsClaimed(uint256 tokenId) external view returns (uint256)
```

Calculates the amount of staking rewards already claimed for a PoolToken.
This function is provided for the sake of external (e.g. frontend client) consumption;
it is not necessary as an input to the mutative calculations in this contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of GFI claimed |

### withdrawMultiple

```solidity
function withdrawMultiple(uint256[] tokenIds) public
```

PoolToken request to withdraw multiple PoolTokens allocated rewards

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of pool token id |

### withdraw

```solidity
function withdraw(uint256 tokenId) public
```

PoolToken request to withdraw all allocated rewards

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

### stakingRewardsEarnedSinceLastWithdraw

```solidity
function stakingRewardsEarnedSinceLastWithdraw(uint256 tokenId) public view returns (uint256)
```

Returns the amount of staking rewards earned by a given token since the last
time its staking rewards were withdrawn.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | token id to get rewards |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of rewards |

### _allocateRewards

```solidity
function _allocateRewards(uint256 _interestPaymentAmount) internal
```

### _allocateStakingRewards

```solidity
function _allocateStakingRewards() internal
```

### _checkpointPoolStakingRewards

```solidity
function _checkpointPoolStakingRewards(contract ITranchedPool pool, bool publish) internal
```

Checkpoints staking reward accounting for a given pool.

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to checkpoint |
| publish | bool | if true, the updated rewards values will be immediately available for                 backers to withdraw. otherwise, the accounting will be updated but backers                 will not be able to withdraw |

### _checkpointSliceStakingRewards

```solidity
function _checkpointSliceStakingRewards(contract ITranchedPool pool, uint256 sliceIndex, bool publish) internal
```

checkpoint the staking rewards accounting for a single tranched pool slice

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool that the slice belongs to |
| sliceIndex | uint256 | index of slice to checkpoint rewards accounting for |
| publish | bool | if true, the updated rewards values will be immediately available for                 backers to withdraw. otherwise, the accounting will be updated but backers                 will not be able to withdraw |

### _checkpointTokenStakingRewards

```solidity
function _checkpointTokenStakingRewards(uint256 tokenId) internal
```

Updates the staking rewards accounting for for a given tokenId

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | token id to checkpoint |

### _calculateNewGrossGFIRewardsForInterestAmount

```solidity
function _calculateNewGrossGFIRewardsForInterestAmount(uint256 _interestPaymentAmount) internal view returns (uint256)
```

Calculate the rewards earned for a given interest payment

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interestPaymentAmount | uint256 | interest payment amount times 1e6 |

### _isSeniorTrancheToken

```solidity
function _isSeniorTrancheToken(struct IPoolTokens.TokenInfo tokenInfo) internal pure returns (bool)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the provided &#x60;tokenInfo&#x60; is a token corresponding to a senior tranche. |

### _usdcToAtomic

```solidity
function _usdcToAtomic(uint256 amount) internal pure returns (uint256)
```

Returns an amount with the base of usdc (1e6) as an 1e18 number

### _atomicToUsdc

```solidity
function _atomicToUsdc(uint256 amount) internal pure returns (uint256)
```

Returns an amount with the base 1e18 as a usdc amount (1e6)

### _fiduToUsdc

```solidity
function _fiduToUsdc(uint256 amount, uint256 sharePrice) internal pure returns (uint256)
```

Returns the equivalent amount of USDC given an amount of fidu and a share price

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount of FIDU |
| sharePrice | uint256 | share price of FIDU |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | equivalent amount of USDC |

### _sliceIndexToJuniorTrancheId

```solidity
function _sliceIndexToJuniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the junior tranche id for the given slice index

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | junior tranche id of given slice index |

### _juniorTrancheIdToSliceIndex

```solidity
function _juniorTrancheIdToSliceIndex(uint256 trancheId) internal pure returns (uint256)
```

Returns the slice index for the given junior tranche id

| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheId | uint256 | tranche id |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | slice index that the given tranche id belongs to |

### _getUpdatedStakingRewards

```solidity
function _getUpdatedStakingRewards() internal returns (contract IStakingRewards)
```

get the StakingRewards contract after checkpoint the rewards values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IStakingRewards | StakingRewards with updated rewards values |

### _poolRewardsHaveBeenInitialized

```solidity
function _poolRewardsHaveBeenInitialized(contract ITranchedPool pool) internal view returns (bool)
```

Returns true if a TranchedPool&#x27;s rewards parameters have been initialized, otherwise false

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to check rewards info |

### _poolStakingRewardsInfoHaveBeenInitialized

```solidity
function _poolStakingRewardsInfoHaveBeenInitialized(struct BackerRewards.StakingRewardsPoolInfo poolInfo) internal pure returns (bool)
```

Returns true if a given pool&#x27;s staking rewards parameters have been initialized

### _sliceRewardsHaveBeenInitialized

```solidity
function _sliceRewardsHaveBeenInitialized(contract ITranchedPool pool, uint256 sliceIndex) internal view returns (bool)
```

Returns true if a TranchedPool&#x27;s slice&#x27;s rewards parameters have been initialized, otherwise false

### _getSliceAccumulatorAtLastCheckpoint

```solidity
function _getSliceAccumulatorAtLastCheckpoint(struct BackerRewards.StakingRewardsSliceInfo sliceInfo, struct BackerRewards.StakingRewardsPoolInfo poolInfo) internal pure returns (uint256)
```

Return a slice&#x27;s rewards accumulator if it has been intialized,
          otherwise return the TranchedPool&#x27;s accumulator

### _getTokenAccumulatorAtLastWithdraw

```solidity
function _getTokenAccumulatorAtLastWithdraw(struct BackerRewards.StakingRewardsTokenInfo tokenInfo, struct BackerRewards.StakingRewardsSliceInfo sliceInfo) internal pure returns (uint256)
```

Return a tokenss rewards accumulator if its been initialized, otherwise return the slice&#x27;s accumulator

### _getJuniorTrancheForTranchedPoolSlice

```solidity
function _getJuniorTrancheForTranchedPoolSlice(contract ITranchedPool pool, uint256 sliceIndex) internal view returns (struct ITranchedPool.TrancheInfo)
```

Returns the junior tranche of a pool given a slice index

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to retreive tranche from |
| sliceIndex | uint256 | slice index |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ITranchedPool.TrancheInfo | tranche in specified slice and pool |

### _getPrincipalDeployedForTranche

```solidity
function _getPrincipalDeployedForTranche(struct ITranchedPool.TrancheInfo tranche) internal pure returns (uint256)
```

Return the amount of principal currently deployed in a given slice

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | struct ITranchedPool.TrancheInfo | tranche to get principal outstanding of |

### _initializeStakingRewardsSliceInfo

```solidity
function _initializeStakingRewardsSliceInfo(uint256 fiduSharePriceAtDrawdown, uint256 principalDeployedAtDrawdown, uint256 rewardsAccumulatorAtDrawdown) internal pure returns (struct BackerRewards.StakingRewardsSliceInfo)
```

Return an initialized StakingRewardsSliceInfo with the given parameters

### _calculateProRatedRewardsForPeriod

```solidity
function _calculateProRatedRewardsForPeriod(uint256 rewardsAccruedSinceLastCheckpoint, uint256 lastUpdatedTime, uint256 currentTime, uint256 endTime) internal pure returns (uint256)
```

Returns the amount of rewards accrued from &#x60;lastUpdatedTime&#x60; to &#x60;endTime&#x60;
          We assume the reward rate was linear during this time

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardsAccruedSinceLastCheckpoint | uint256 | rewards accumulated between &#x60;lastUpdatedTime&#x60; and &#x60;currentTime&#x60; |
| lastUpdatedTime | uint256 | the last timestamp the rewards accumulator was updated |
| currentTime | uint256 | the current timestamp |
| endTime | uint256 | the end time of the period that is elligible to accrue rewards |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | approximate rewards accrued from &#x60;lastUpdateTime&#x60; to &#x60;endTime&#x60; |

### _updateStakingRewardsPoolInfoAccumulator

```solidity
function _updateStakingRewardsPoolInfoAccumulator(struct BackerRewards.StakingRewardsPoolInfo poolInfo, uint256 newAccumulatorValue) internal
```

update a Pool&#x27;s staking rewards accumulator

### onlyPool

```solidity
modifier onlyPool()
```

### BackerRewardsClaimed

```solidity
event BackerRewardsClaimed(address owner, uint256 tokenId, uint256 amountOfTranchedPoolRewards, uint256 amountOfSeniorPoolRewards)
```

### BackerRewardsSetTotalRewards

```solidity
event BackerRewardsSetTotalRewards(address owner, uint256 totalRewards, uint256 totalRewardPercentOfTotalGFI)
```

### BackerRewardsSetTotalInterestReceived

```solidity
event BackerRewardsSetTotalInterestReceived(address owner, uint256 totalInterestReceived)
```

### BackerRewardsSetMaxInterestDollarsEligible

```solidity
event BackerRewardsSetMaxInterestDollarsEligible(address owner, uint256 maxInterestDollarsEligible)
```

