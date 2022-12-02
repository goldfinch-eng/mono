## SeniorPool

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822

Main entry point for senior LPs (a.k.a. capital providers)
 Automatically invests across borrower pools using an adjustable strategy.

### USDC_MANTISSA

```solidity
uint256 USDC_MANTISSA
```

### FIDU_MANTISSA

```solidity
uint256 FIDU_MANTISSA
```

### ZAPPER_ROLE

```solidity
bytes32 ZAPPER_ROLE
```

### config

```solidity
contract GoldfinchConfig config
```

### compoundBalance

```solidity
uint256 compoundBalance
```

_DEPRECATED!_

### writedowns

```solidity
mapping(contract ITranchedPool => uint256) writedowns
```

_DEPRECATED, DO NOT USE._

### writedownsByPoolToken

```solidity
mapping(uint256 => uint256) writedownsByPoolToken
```

_Writedowns by PoolToken id. This is used to ensure writedowns are incremental.
  Example: At t1, a pool is late and should be written down by 10%. At t2, the pool
  is even later, and should be written down by 25%. This variable helps ensure that
  if writedowns occur at both t1 and t2, t2's writedown is only by the delta of 15%,
  rather than double-counting the writedown percent from t1._

### _checkpointedEpochId

```solidity
uint256 _checkpointedEpochId
```

### _epochs

```solidity
mapping(uint256 => struct ISeniorPoolEpochWithdrawals.Epoch) _epochs
```

### _withdrawalRequests

```solidity
mapping(uint256 => struct ISeniorPoolEpochWithdrawals.WithdrawalRequest) _withdrawalRequests
```

### _usdcAvailable

```solidity
uint256 _usdcAvailable
```

_Tracks usdc available for investments, zaps, withdrawal allocations etc. Due to the time
based nature of epochs, if the last epoch has ended but isn't checkpointed yet then this var
doesn't reflect the true usdc available at the current timestamp. To query for the up to date
usdc available without having to execute a tx, use the usdcAvailable() view fn_

### _epochDuration

```solidity
uint256 _epochDuration
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### setEpochDuration

```solidity
function setEpochDuration(uint256 newEpochDuration) external
```

Update epoch duration

_Triggers a checkpoint_

### initializeEpochs

```solidity
function initializeEpochs() external
```

Initialize the epoch withdrawal system. This includes writing the
         initial epoch and snapshotting usdcAvailable at the current usdc balance of
         the senior pool.

### deposit

```solidity
function deposit(uint256 amount) public returns (uint256 depositShares)
```

Deposits `amount` USDC from msg.sender into the SeniorPool, and grants you the
 equivalent value of FIDU tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of USDC to deposit |

### depositWithPermit

```solidity
function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 depositShares)
```

Identical to deposit, except it allows for a passed up signature to permit
 the Senior Pool to move funds on behalf of the user, all within one transaction.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of USDC to deposit |
| deadline | uint256 |  |
| v | uint8 | secp256k1 signature component |
| r | bytes32 | secp256k1 signature component |
| s | bytes32 | secp256k1 signature component |

### addToWithdrawalRequest

```solidity
function addToWithdrawalRequest(uint256 fiduAmount, uint256 tokenId) external
```

Add `fiduAmount` FIDU to a withdrawal request for `tokenId`. Caller
must own tokenId

_Reverts if a withdrawal with the given tokenId does not exist
Reverts if the caller is not the owner of the given token
Triggers a checkpoint_

### requestWithdrawal

```solidity
function requestWithdrawal(uint256 fiduAmount) external returns (uint256)
```

Submit a request to withdraw `fiduAmount` of FIDU. Request is rejected
if callers already owns a request token. A non-transferrable request token is
minted to the caller

_triggers a checkpoint_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | tokenId token minted to caller |

### cancelWithdrawalRequest

```solidity
function cancelWithdrawalRequest(uint256 tokenId) external returns (uint256)
```

Cancel request for tokenId. The fiduRequested (minus a fee) is returned
to the caller. Caller must own tokenId.

_triggers a checkpoint_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | fiduReceived the fidu amount returned to the caller |

### claimWithdrawalRequest

```solidity
function claimWithdrawalRequest(uint256 tokenId) external returns (uint256)
```

Transfer the usdcWithdrawable of request for tokenId to the caller.
Caller must own tokenId

_triggers a checkpoint_

### epochDuration

```solidity
function epochDuration() external view returns (uint256)
```

Current duration of withdrawal epochs, in seconds

### withdrawalRequest

```solidity
function withdrawalRequest(uint256 tokenId) external view returns (struct ISeniorPoolEpochWithdrawals.WithdrawalRequest)
```

Get request by tokenId. A request is considered active if epochCursor > 0.

### _previewEpochCheckpoint

```solidity
function _previewEpochCheckpoint(struct ISeniorPoolEpochWithdrawals.Epoch epoch) internal view returns (struct ISeniorPoolEpochWithdrawals.Epoch, enum SeniorPool.EpochCheckpointStatus)
```

Preview the effects of attempting to checkpoint a given epoch. If
        the epoch doesn't need to be checkpointed then the same epoch will be return
         along with a bool indicated it didn't need to be checkpointed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| epoch | struct ISeniorPoolEpochWithdrawals.Epoch | epoch to checkpoint |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ISeniorPoolEpochWithdrawals.Epoch | maybeCheckpointedEpoch the checkpointed epoch if the epoch was                                  able to be checkpointed, otherwise the same epoch |
| [1] | enum SeniorPool.EpochCheckpointStatus | epochStatus If the epoch can't be finalized, returns `Unapplied`.                      If the Epoch is after the end time of the epoch the epoch will be extended.                      An extended epoch will have its endTime set to the next endtime but won't                      have any usdc allocated to it. If the epoch can be finalized and its after                      the end time, it will have usdc allocated to it. |

### _headEpoch

```solidity
function _headEpoch() internal view returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

Returns the most recent, uncheckpointed epoch

### _previewWithdrawRequestCheckpoint

```solidity
function _previewWithdrawRequestCheckpoint(struct ISeniorPoolEpochWithdrawals.WithdrawalRequest wr) internal view returns (struct ISeniorPoolEpochWithdrawals.WithdrawalRequest)
```

Returns the state of a withdraw request after checkpointing

### _mostRecentEndsAtAfter

```solidity
function _mostRecentEndsAtAfter(uint256 endsAt) internal view returns (uint256)
```

Returns the most recent time an epoch would end assuming the current epoch duration
         and the starting point of `endsAt`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| endsAt | uint256 | basis for calculating the most recent endsAt time |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | mostRecentEndsAt The most recent endsAt |

### _sendToReserve

```solidity
function _sendToReserve(uint256 amount, address userForEvent) internal
```

### _applyInitializeNextEpochFrom

```solidity
function _applyInitializeNextEpochFrom(struct ISeniorPoolEpochWithdrawals.Epoch previousEpoch) internal returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

Initialize the next epoch using a given epoch by carrying forward its oustanding fidu

### _initializeNextEpochFrom

```solidity
function _initializeNextEpochFrom(struct ISeniorPoolEpochWithdrawals.Epoch previousEpoch) internal view returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

### _applyEpochCheckpoints

```solidity
function _applyEpochCheckpoints() private returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

Increment _checkpointedEpochId cursor up to the current epoch

### _applyWithdrawalRequestCheckpoint

```solidity
function _applyWithdrawalRequestCheckpoint(uint256 tokenId) internal returns (struct ISeniorPoolEpochWithdrawals.WithdrawalRequest)
```

### _applyEpochAndRequestCheckpoints

```solidity
function _applyEpochAndRequestCheckpoints(uint256 tokenId) internal returns (struct ISeniorPoolEpochWithdrawals.Epoch, struct ISeniorPoolEpochWithdrawals.WithdrawalRequest)
```

### _applyEpochCheckpoint

```solidity
function _applyEpochCheckpoint(struct ISeniorPoolEpochWithdrawals.Epoch epoch) internal returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

Checkpoint an epoch, returning the same epoch if it doesn't need
to be checkpointed or a newly initialized epoch if the given epoch was
successfully checkpointed. In other words, return the most current epoch

_To decrease storage writes we have introduced optimizations based on two observations
     1. If block.timestamp < endsAt, then the epoch is unchanged and we can return
      the unmodified epoch (checkpointStatus == Unappled).
     2. If the epoch has ended but its fiduRequested is 0 OR the senior pool's usdcAvailable
      is 0, then the next epoch will have the SAME fiduRequested, and the only variable we have to update
      is endsAt (chekpointStatus == Extended)._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| epoch | struct ISeniorPoolEpochWithdrawals.Epoch | epoch to checkpoint |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ISeniorPoolEpochWithdrawals.Epoch | currentEpoch current epoch |

### _burnWithdrawRequest

```solidity
function _burnWithdrawRequest(uint256 tokenId) internal
```

### withdraw

```solidity
function withdraw(uint256 usdcAmount) external returns (uint256 amount)
```

Withdraws USDC from the SeniorPool to msg.sender, and burns the equivalent value of FIDU tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to withdraw |

### withdrawInFidu

```solidity
function withdrawInFidu(uint256 fiduAmount) external returns (uint256 amount)
```

Withdraws USDC (denominated in FIDU terms) from the SeniorPool to msg.sender

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| fiduAmount | uint256 | The amount of USDC to withdraw in terms of FIDU shares |

### _withdraw

```solidity
function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal returns (uint256 userAmount)
```

### invest

```solidity
function invest(contract ITranchedPool pool) external returns (uint256)
```

Invest in an ITranchedPool's senior tranche using the senior pool's strategy

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | An ITranchedPool whose senior tranche should be considered for investment |

### redeem

```solidity
function redeem(uint256 tokenId) external
```

Redeem interest and/or principal from an ITranchedPool investment

_triggers a checkpoint_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | the ID of an IPoolTokens token to be redeemed |

### writedown

```solidity
function writedown(uint256 tokenId) external
```

Write down an ITranchedPool investment. This will adjust the senior pool's share price
 down if we're considering the investment a loss, or up if the borrower has subsequently
 made repayments that restore confidence that the full loan will be repaid.

_triggers a checkpoint_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | the ID of an IPoolTokens token to be considered for writedown |

### usdcAvailable

```solidity
function usdcAvailable() public view returns (uint256)
```

Returns the amount of unallocated usdc in the senior pool, taking into account
        usdc that _will_ be allocated to withdrawals when a checkpoint happens

### currentEpoch

```solidity
function currentEpoch() external view returns (struct ISeniorPoolEpochWithdrawals.Epoch)
```

The current withdrawal epoch

### assets

```solidity
function assets() external view returns (uint256)
```

Returns the net assests controlled by and owed to the pool

### sharesOutstanding

```solidity
function sharesOutstanding() external view returns (uint256)
```

Returns the number of shares outstanding, accounting for shares that will be burned
         when an epoch checkpoint happens

### getNumShares

```solidity
function getNumShares(uint256 usdcAmount) public view returns (uint256)
```

### estimateInvestment

```solidity
function estimateInvestment(contract ITranchedPool pool) external view returns (uint256)
```

### calculateWritedown

```solidity
function calculateWritedown(uint256 tokenId) external view returns (uint256)
```

Calculates the writedown amount for a particular pool position

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token reprsenting the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount in dollars the principal should be written down by |

### _getNumShares

```solidity
function _getNumShares(uint256 _usdcAmount, uint256 _sharePrice) internal pure returns (uint256)
```

### _calculateWritedown

```solidity
function _calculateWritedown(contract ITranchedPool pool, uint256 principal) internal view returns (uint256 writedownPercent, uint256 writedownAmount)
```

### _distributeLosses

```solidity
function _distributeLosses(int256 writedownDelta) internal
```

### _collectInterestAndPrincipal

```solidity
function _collectInterestAndPrincipal(address from, uint256 interest, uint256 principal) internal
```

### _isValidPool

```solidity
function _isValidPool(contract ITranchedPool pool) internal view returns (bool)
```

### _approvePool

```solidity
function _approvePool(contract ITranchedPool pool, uint256 allowance) internal
```

### _usdcToFidu

```solidity
function _usdcToFidu(uint256 amount) internal pure returns (uint256)
```

### _fiduToUsdc

```solidity
function _fiduToUsdc(uint256 amount) internal pure returns (uint256)
```

### _getUSDCAmountFromShares

```solidity
function _getUSDCAmountFromShares(uint256 fiduAmount) internal view returns (uint256)
```

### _getUSDCAmountFromShares

```solidity
function _getUSDCAmountFromShares(uint256 _fiduAmount, uint256 _sharePrice) internal pure returns (uint256)
```

### _usdcToSharePrice

```solidity
function _usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256)
```

### _totalShares

```solidity
function _totalShares() internal view returns (uint256)
```

### _sliceIndexToSeniorTrancheId

```solidity
function _sliceIndexToSeniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the senion tranche id for the given slice index

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | senior tranche id of given slice index |

### onlyZapper

```solidity
modifier onlyZapper()
```

### EpochCheckpointStatus

```solidity
enum EpochCheckpointStatus {
  Unapplied,
  Extended,
  Finalized
}
```

