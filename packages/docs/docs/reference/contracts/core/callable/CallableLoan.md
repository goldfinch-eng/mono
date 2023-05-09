## CallableLoan

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x384fb62AdB60B18f561F83EBB31e84333DeF5205

A loan that allows the lenders to call back capital from the borrower.

### LOCKER_ROLE

```solidity
bytes32 LOCKER_ROLE
```

### SPLIT_TOKEN_DUST_THRESHOLD

```solidity
uint256 SPLIT_TOKEN_DUST_THRESHOLD
```

### MAJOR_VERSION

```solidity
uint8 MAJOR_VERSION
```

### MINOR_VERSION

```solidity
uint8 MINOR_VERSION
```

### PATCH_VERSION

```solidity
uint8 PATCH_VERSION
```

### _staleCreditLine

```solidity
struct StaleCallableCreditLine _staleCreditLine
```

### drawdownsPaused

```solidity
bool drawdownsPaused
```

### allowedUIDTypes

```solidity
uint256[] allowedUIDTypes
```

### config

```solidity
contract IGoldfinchConfig config
```

### createdAt

```solidity
uint256 createdAt
```

Time when the pool was initialized. Zero if uninitialized

### borrower

```solidity
address borrower
```

### initialize

```solidity
function initialize(contract IGoldfinchConfig _config, address _borrower, uint256 _limit, uint256 _interestApr, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) external
```

Initialize the pool. Can only be called once, and should be called in the same transaction as
  contract creation to avoid initialization front-running

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | contract IGoldfinchConfig | address of GoldfinchConfig |
| _borrower | address | address of borrower, a non-transferrable role for performing privileged actions like   drawdown |
| _limit | uint256 |  |
| _interestApr | uint256 | interest rate for the loan |
| _numLockupPeriods | uint256 | the number of periods at the tail end of a principal period during which call requests   are not allowed |
| _schedule | contract ISchedule |  |
| _lateFeeApr | uint256 | late fee interest rate for the loan, which kicks in `LatenessGracePeriodInDays` days after a   payment becomes late |
| _fundableAt | uint256 | earliest time at which the first slice can be funded |
| _allowedUIDTypes | uint256[] |  |

### submitCall

```solidity
function submitCall(uint256 callAmount, uint256 poolTokenId) external returns (uint256 callRequestedTokenId, uint256 remainingTokenId)
```

Submit a call request for the given amount of capital.
        The borrower is obligated to pay the call request back at the end of the
        corresponding call request period.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| callAmount | uint256 | Amount of capital to call back |
| poolTokenId | uint256 | Pool token id to be called back. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| callRequestedTokenId | uint256 | callRequestedTokenId  Token id of the call requested token. |
| remainingTokenId | uint256 | remainingTokenId Token id of the remaining token. |

### deposit

```solidity
function deposit(uint256 tranche, uint256 amount) external returns (uint256)
```

Supply capital to the loan.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 | Should always be uncalled capital tranche index. |
| amount | uint256 | amount of capital to supply |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | tokenId NFT representing your position in this pool |

### depositWithPermit

```solidity
function depositWithPermit(uint256 tranche, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 tokenId)
```

Supply capital to the loan.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 | Should always be uncalled capital tranche index. |
| amount | uint256 | amount of capital to supply |
| deadline | uint256 | deadline of permit operation |
| v | uint8 | v portion of signature |
| r | bytes32 | r portion of signature |
| s | bytes32 | s portion of signature |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | NFT representing your position in this pool |

### withdraw

```solidity
function withdraw(uint256 tokenId, uint256 amount) external returns (uint256, uint256)
```

Withdraw an already deposited amount if the funds are available. Caller must be the owner or
  approved by the owner on tokenId. Amount withdrawn is sent to the caller.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | the NFT representing the position |
| amount | uint256 | amount to withdraw (must be <= interest+principal available to withdraw) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |

### withdrawMultiple

```solidity
function withdrawMultiple(uint256[] tokenIds, uint256[] amounts) external
```

Withdraw from multiple tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | NFT positions to withdraw. Caller must be an owner or approved on all tokens in the array |
| amounts | uint256[] | amounts to withdraw from positions such that amounts[i] is withdrawn from position tokenIds[i] |

### withdrawMax

```solidity
function withdrawMax(uint256 tokenId) external returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
```

Similar to withdraw but withdraw the max interest and principal available for `tokenId`

### drawdown

```solidity
function drawdown(uint256 amount) external
```

Drawdown the loan. The credit line's balance should increase by the amount drawn down.
  Junior capital must be locked before this function can be called. If senior capital isn't locked
  then this function will lock it for you (convenience to avoid calling lockPool() separately).
  This function should revert if the amount requested exceeds the the current slice's currentLimit
  This function should revert if the caller is not the borrower.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC to drawdown. This amount is transferred to the caller |

### pay

```solidity
function pay(uint256 amount) external returns (struct ILoan.PaymentAllocation)
```

Pay down interest + principal. Excess payments are refunded to the caller

_{this} must be approved by msg.sender to transfer {amount} of USDC_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC amount to pay |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | PaymentAllocation info on how the payment was allocated |

### pauseDrawdowns

```solidity
function pauseDrawdowns() external
```

Pauses all drawdowns (but not deposits/withdraws)

### unpauseDrawdowns

```solidity
function unpauseDrawdowns() external
```

Unpause drawdowns

### setAllowedUIDTypes

```solidity
function setAllowedUIDTypes(uint256[] ids) external
```

Set accepted UID types for the loan.
Requires that users have not already begun to deposit.

### setFundableAt

```solidity
function setFundableAt(uint256 newFundableAt) external
```

Update `fundableAt` to a new timestamp. Only the borrower can call this.

### getLoanType

```solidity
function getLoanType() external pure returns (enum LoanType)
```

getLoanType was added to support the new callable loan type.
        It is not supported in older versions of ILoan (e.g. legacy TranchedPools)

### getFundableAt

```solidity
function getFundableAt() external view returns (uint256)
```

### getAllowedUIDTypes

```solidity
function getAllowedUIDTypes() external view returns (uint256[])
```

### inLockupPeriod

```solidity
function inLockupPeriod() public view returns (bool)
```

### numLockupPeriods

```solidity
function numLockupPeriods() public view returns (uint256)
```

### estimateOwedInterestAt

```solidity
function estimateOwedInterestAt(uint256 assumedBalance, uint256 timestamp) public view returns (uint256)
```

Returns a naive estimate of the interest owed at the timestamp.
        Omits any late fees, and assumes no future payments.

### estimateOwedInterestAt

```solidity
function estimateOwedInterestAt(uint256 timestamp) external view returns (uint256)
```

Returns a naive estimate of the interest owed at the timestamp.
        Omits any late fees, and assumes no future payments.

### loanPhase

```solidity
function loanPhase() public view returns (enum LoanPhase)
```

Returns the current phase of the loan.
        See documentation on LoanPhase enum.

### interestBearingBalance

```solidity
function interestBearingBalance() public view returns (uint256)
```

TODO: Low priority tests - currently only used for tests and frontend

### getAmountsOwed

```solidity
function getAmountsOwed(uint256 timestamp) external view returns (uint256 returnedInterestOwed, uint256 returnedInterestAccrued, uint256 returnedPrincipalOwed)
```

Compute interest and principal owed on the current balance at a future timestamp

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | time to calculate up to |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| returnedInterestOwed | uint256 |  |
| returnedInterestAccrued | uint256 |  |
| returnedPrincipalOwed | uint256 |  |

### uncalledCapitalTrancheIndex

```solidity
function uncalledCapitalTrancheIndex() public view returns (uint256)
```

### getUncalledCapitalInfo

```solidity
function getUncalledCapitalInfo() external view returns (struct ICallableLoan.UncalledCapitalInfo)
```

### getCallRequestPeriod

```solidity
function getCallRequestPeriod(uint256 callRequestPeriodIndex) external view returns (struct ICallableLoan.CallRequestPeriod)
```

### availableToCall

```solidity
function availableToCall(uint256 tokenId) public view returns (uint256)
```

### availableToWithdraw

```solidity
function availableToWithdraw(uint256 tokenId) public view returns (uint256, uint256)
```

Query the max amount available to withdraw for tokenId's position

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | position to query max amount withdrawable for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |

### hasAllowedUID

```solidity
function hasAllowedUID(address sender) public view returns (bool)
```

### _pay

```solidity
function _pay(uint256 amount) internal returns (struct ILoan.PaymentAllocation)
```

### _deposit

```solidity
function _deposit(uint256 tranche, uint256 amount) internal returns (uint256)
```

Supply capital to the loan.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 | Should always be uncalled capital tranche index. |
| amount | uint256 | amount of capital to supply |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | tokenId NFT representing your position in this pool |

### _withdraw

```solidity
function _withdraw(struct IPoolTokens.TokenInfo tokenInfo, uint256 tokenId, uint256 amount) internal returns (uint256, uint256)
```

### _withdraw

```solidity
function _withdraw(struct IPoolTokens.TokenInfo tokenInfo, uint256 tokenId, uint256 amount, struct CallableCreditLine cl) internal returns (uint256, uint256)
```

### _withdrawMax

```solidity
function _withdrawMax(uint256 tokenId) internal returns (uint256, uint256)
```

### nextPrincipalDueTime

```solidity
function nextPrincipalDueTime() public view returns (uint256)
```

### nextDueTimeAt

```solidity
function nextDueTimeAt(uint256 timestamp) public view returns (uint256)
```

### nextInterestDueTimeAt

```solidity
function nextInterestDueTimeAt(uint256 timestamp) public view returns (uint256)
```

### schedule

```solidity
function schedule() public view returns (contract ISchedule)
```

### _reserveFundsFeePercent

```solidity
function _reserveFundsFeePercent() public view returns (uint256)
```

### _availableToWithdraw

```solidity
function _availableToWithdraw(struct IPoolTokens.TokenInfo tokenInfo) internal view returns (uint256 interestAvailable, uint256 principalAvailable)
```

### _availableToWithdraw

```solidity
function _availableToWithdraw(struct IPoolTokens.TokenInfo tokenInfo, struct CallableCreditLine cl) internal view returns (uint256 interestAvailable, uint256 principalAvailable)
```

### _availableToWithdrawGivenProportions

```solidity
function _availableToWithdrawGivenProportions(struct IPoolTokens.TokenInfo tokenInfo, uint256 totalInterestWithdrawable, uint256 totalPrincipalWithdrawable) internal view returns (uint256 interestAvailable, uint256 principalAvailable)
```

### creditLine

```solidity
function creditLine() external view returns (contract ICreditLine)
```

Pool's credit line, responsible for managing the loan's accounting variables

### balance

```solidity
function balance() public view returns (uint256)
```

### interestOwed

```solidity
function interestOwed() public view returns (uint256)
```

### principalOwed

```solidity
function principalOwed() public view returns (uint256)
```

### termEndTime

```solidity
function termEndTime() public view returns (uint256)
```

### nextDueTime

```solidity
function nextDueTime() public view returns (uint256)
```

### interestAccruedAsOf

```solidity
function interestAccruedAsOf() public view returns (uint256)
```

We keep this to conform to the ICreditLine interface, but it's redundant information
  now that we have `checkpointedAsOf`

### currentLimit

```solidity
function currentLimit() public view returns (uint256)
```

### limit

```solidity
function limit() public view returns (uint256)
```

### interestApr

```solidity
function interestApr() public view returns (uint256)
```

### lateFeeApr

```solidity
function lateFeeApr() public view returns (uint256)
```

### isLate

```solidity
function isLate() public view returns (bool)
```

### totalInterestAccrued

```solidity
function totalInterestAccrued() public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalInterestAccruedAt

```solidity
function totalInterestAccruedAt(uint256 timestamp) public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalInterestPaid

```solidity
function totalInterestPaid() public view returns (uint256)
```

Cumulative interest paid back up to now

### totalInterestOwed

```solidity
function totalInterestOwed() public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalInterestOwedAt

```solidity
function totalInterestOwedAt(uint256 timestamp) public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### interestOwedAt

```solidity
function interestOwedAt(uint256 timestamp) public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### interestAccrued

```solidity
function interestAccrued() public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### interestAccruedAt

```solidity
function interestAccruedAt(uint256 timestamp) public view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### principalOwedAt

```solidity
function principalOwedAt(uint256 timestamp) public view returns (uint256)
```

Principal owed up to `timestamp`

### totalPrincipalPaid

```solidity
function totalPrincipalPaid() public view returns (uint256)
```

Returns the total amount of principal thats been paid

### totalPrincipalOwedAt

```solidity
function totalPrincipalOwedAt(uint256 timestamp) public view returns (uint256)
```

Cumulative principal owed at timestamp

### totalPrincipalOwed

```solidity
function totalPrincipalOwed() public view returns (uint256)
```

Cumulative principal owed at current timestamp

### termStartTime

```solidity
function termStartTime() public view returns (uint256)
```

Time of first drawdown

### withinPrincipalGracePeriod

```solidity
function withinPrincipalGracePeriod() public view returns (bool)
```

### lastFullPaymentTime

```solidity
function lastFullPaymentTime() public view returns (uint256)
```

### pay

```solidity
function pay(uint256, uint256) external pure returns (struct ILoan.PaymentAllocation)
```

Unsupported in callable loans.

### maxLimit

```solidity
function maxLimit() external pure returns (uint256)
```

Unsupported in callable loans.

### setMaxLimit

```solidity
function setMaxLimit(uint256) external pure
```

Unsupported in callable loans.

### setLimit

```solidity
function setLimit(uint256) external pure
```

Unsupported ICreditLine method kept for ICreditLine conformance

### getVersion

```solidity
function getVersion() external pure returns (uint8[3] version)
```

Returns the version triplet `[major, minor, patch]`

### onlyLocker

```solidity
modifier onlyLocker()
```

