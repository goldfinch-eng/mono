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
mapping(uint256 => struct IBackerRewards.BackerRewardsTokenInfo) tokens
```

### pools

```solidity
mapping(address => struct IBackerRewards.BackerRewardsInfo) pools
```

### poolStakingRewards

```solidity
mapping(contract ITranchedPool => struct IBackerRewards.StakingRewardsPoolInfo) poolStakingRewards
```

### tokenStakingRewards

```solidity
mapping(uint256 => struct IBackerRewards.StakingRewardsTokenInfo) tokenStakingRewards
```

Staking rewards info for each pool token

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) public
```

### allocateRewards

```solidity
function allocateRewards(uint256 _interestPaymentAmount) external
```

Calculates the accRewardsPerPrincipalDollar for a given pool,
  when a interest payment is received by the protocol

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interestPaymentAmount | uint256 | Atomic usdc amount of the interest payment |

### setTotalRewards

```solidity
function setTotalRewards(uint256 _totalRewards) public
```

Set the total gfi rewards and the % of total GFI

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _totalRewards | uint256 | The amount of GFI rewards available, expects 10^18 value |

### setTotalInterestReceived

```solidity
function setTotalInterestReceived(uint256 _totalInterestReceived) public
```

Set the total interest received to date.
This should only be called once on contract deploy.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _totalInterestReceived | uint256 | The amount of interest the protocol has received to date, expects 10^6 value |

### setMaxInterestDollarsEligible

```solidity
function setMaxInterestDollarsEligible(uint256 _maxInterestDollarsEligible) public
```

Set the max dollars across the entire protocol that are eligible for GFI rewards

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _maxInterestDollarsEligible | uint256 | The amount of interest dollars eligible for GFI rewards, expects 10^18 value |

### setPoolTokenAccRewardsPerPrincipalDollarAtMint

```solidity
function setPoolTokenAccRewardsPerPrincipalDollarAtMint(address poolAddress, uint256 tokenId) external
```

When a pool token is minted for multiple drawdowns,
  set accRewardsPerPrincipalDollarAtMint to the current accRewardsPerPrincipalDollar price

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | Address of the pool associated with the pool token |
| tokenId | uint256 | Pool token id |

### onTranchedPoolDrawdown

```solidity
function onTranchedPoolDrawdown(uint256 _sliceIndex) external
```

callback for TranchedPools when they drawdown

_initializes rewards info for the calling TranchedPool if it's the first
 drawdown for the given slice_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _sliceIndex | uint256 |  |

### setBackerAndStakingRewardsTokenInfoOnSplit

```solidity
function setBackerAndStakingRewardsTokenInfoOnSplit(struct IBackerRewards.BackerRewardsTokenInfo originalBackerRewardsTokenInfo, struct IBackerRewards.StakingRewardsTokenInfo originalStakingRewardsTokenInfo, uint256 newTokenId, uint256 newRewardsClaimed) external
```

Set BackerRewards and BackerStakingRewards metadata for tokens created by a pool token split.

_The sum of newRewardsClaimed across the split tokens MUST be equal to (or be very slightly smaller
than, in the case of rounding due to integer division) the original token's rewardsClaimed. Furthermore,
they must be split proportional to the original and new token's principalAmounts. This impl validates
neither of those things because only the pool tokens contract can call it, and it trusts that the PoolTokens
contract doesn't call maliciously._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| originalBackerRewardsTokenInfo | struct IBackerRewards.BackerRewardsTokenInfo | backer rewards info for the pool token that was split |
| originalStakingRewardsTokenInfo | struct IBackerRewards.StakingRewardsTokenInfo | backer staking rewards info for the pool token that was split |
| newTokenId | uint256 | id of one of the tokens in the split |
| newRewardsClaimed | uint256 | rewardsClaimed value for the new token. |

### clearTokenInfo

```solidity
function clearTokenInfo(uint256 tokenId) external
```

Clear all BackerRewards and StakingRewards associated data for `tokenId`

### getTokenInfo

```solidity
function getTokenInfo(uint256 poolTokenId) external view returns (struct IBackerRewards.BackerRewardsTokenInfo)
```

Get backer rewards metadata for a pool token

### getStakingRewardsTokenInfo

```solidity
function getStakingRewardsTokenInfo(uint256 poolTokenId) external view returns (struct IBackerRewards.StakingRewardsTokenInfo)
```

Get backer staking rewards metadata for a pool token

### getBackerStakingRewardsPoolInfo

```solidity
function getBackerStakingRewardsPoolInfo(contract ITranchedPool pool) external view returns (struct IBackerRewards.StakingRewardsPoolInfo)
```

Get backer staking rewards for a pool

### poolTokenClaimableRewards

```solidity
function poolTokenClaimableRewards(uint256 tokenId) public view returns (uint256)
```

Calculate the gross available gfi rewards for a PoolToken

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

#### Return Values

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

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of GFI claimed |

### withdrawMultiple

```solidity
function withdrawMultiple(uint256[] tokenIds) public
```

PoolToken request to withdraw multiple PoolTokens allocated rewards

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of pool token id |

### withdraw

```solidity
function withdraw(uint256 tokenId) public returns (uint256)
```

PoolToken request to withdraw all allocated rewards

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | Pool token id |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of rewards withdrawn |

### stakingRewardsEarnedSinceLastWithdraw

```solidity
function stakingRewardsEarnedSinceLastWithdraw(uint256 tokenId) public view returns (uint256)
```

Returns the amount of staking rewards earned by a given token since the last
time its staking rewards were withdrawn.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | token id to get rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | amount of rewards |

### _allocateRewards

```solidity
function _allocateRewards(uint256 _interestPaymentAmount) internal
```

### _checkpointTokenStakingRewards

```solidity
function _checkpointTokenStakingRewards(uint256 tokenId) internal
```

Updates the staking rewards accounting for for a given tokenId

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | token id to checkpoint |

### _calculateNewGrossGFIRewardsForInterestAmount

```solidity
function _calculateNewGrossGFIRewardsForInterestAmount(uint256 _interestPaymentAmount) internal view returns (uint256)
```

Calculate the rewards earned for a given interest payment

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interestPaymentAmount | uint256 | interest payment amount times 1e6 |

### _isSeniorTrancheToken

```solidity
function _isSeniorTrancheToken(struct IPoolTokens.TokenInfo tokenInfo) internal pure returns (bool)
```

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Whether the provided `tokenInfo` is a token corresponding to a senior tranche. |

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

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount of FIDU |
| sharePrice | uint256 | share price of FIDU |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | equivalent amount of USDC |

### _juniorTrancheIdToSliceIndex

```solidity
function _juniorTrancheIdToSliceIndex(uint256 trancheId) internal pure returns (uint256)
```

Returns the slice index for the given junior tranche id

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheId | uint256 | tranche id |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | slice index that the given tranche id belongs to |

### _poolRewardsHaveBeenInitialized

```solidity
function _poolRewardsHaveBeenInitialized(contract ITranchedPool pool) internal view returns (bool)
```

Returns true if a TranchedPool's rewards parameters have been initialized, otherwise false

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to check rewards info |

### _poolStakingRewardsInfoHaveBeenInitialized

```solidity
function _poolStakingRewardsInfoHaveBeenInitialized(struct IBackerRewards.StakingRewardsPoolInfo poolInfo) internal pure returns (bool)
```

Returns true if a given pool's staking rewards parameters have been initialized

### _sliceRewardsHaveBeenInitialized

```solidity
function _sliceRewardsHaveBeenInitialized(contract ITranchedPool pool, uint256 sliceIndex) internal view returns (bool)
```

Returns true if a TranchedPool's slice's rewards parameters have been initialized, otherwise false

### _getSliceAccumulatorAtLastCheckpoint

```solidity
function _getSliceAccumulatorAtLastCheckpoint(struct IBackerRewards.StakingRewardsSliceInfo sliceInfo, struct IBackerRewards.StakingRewardsPoolInfo poolInfo) internal pure returns (uint256)
```

Return a slice's rewards accumulator if it has been intialized,
          otherwise return the TranchedPool's accumulator

### _getTokenAccumulatorAtLastWithdraw

```solidity
function _getTokenAccumulatorAtLastWithdraw(struct IBackerRewards.StakingRewardsTokenInfo tokenInfo, struct IBackerRewards.StakingRewardsSliceInfo sliceInfo) internal pure returns (uint256)
```

Return a tokenss rewards accumulator if its been initialized, otherwise return the slice's accumulator

### onlyPoolTokens

```solidity
modifier onlyPoolTokens()
```

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

