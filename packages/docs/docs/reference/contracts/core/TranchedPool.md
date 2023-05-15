## TranchedPool

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x1BB013B66cE89E2dB9ACf079F37670311356643E

**Borrower Pool deployments on Ethereum mainnet: **

- [SME Loans in Southeast Asia](https://etherscan.io/address/0x032f7299621c3b68e5d7aceabd567b65e2284da7)
- [Cauris Fund #4: Africa Innovation Pool](https://etherscan.io/address/0x538473c3a69da2b305cf11a40cf2f3904de8db5f)
- [Africa Innovation & Enterprise Pool via Cauris](https://etherscan.io/address/0xd43a4f3041069c6178b99d55295b00d0db955bb5)
- [Asset-Backed Pool via Addem Capital](https://etherscan.io/address/0x89d7c618a4eef3065da8ad684859a547548e6169)
- [Almavest Basket #7: Fintech and Carbon Reduction Basket](https://etherscan.io/address/0x759f097f3153f5d62FF1C2D82bA78B6350F223e3)
- [Lend East #1: Emerging Asia Fintech Pool](https://etherscan.io/address/0xb26b42dd5771689d0a7faeea32825ff9710b9c11)
- [Cauris Fund #2: Africa Innovation Pool](https://etherscan.io/address/0xd09a57127bc40d680be7cb061c2a6629fe71abef)
- [Secured U.S. Fintech Yield via Stratos](https://etherscan.io/address/0x00c27fc71b159a346e179b4a1608a0865e8a7470)
- [Almavest Basket #6](https://etherscan.io/address/0x418749e294cabce5a714efccc22a8aade6f9db57)
- [Almavest Basket #5](https://etherscan.io/address/0x1d596d28a7923a22aa013b0e7082bba23daa656b)
- [Almavest Basket #4](https://etherscan.io/address/0xe6C30756136e07eB5268c3232efBFBe645c1BA5A)
- [Cauris](https://etherscan.io/address/0xc9BDd0D3B80CC6EfE79a82d850f44EC9B55387Ae)
- [Divibank](https://etherscan.io/address/0xf74ea34ac88862b7ff419e60e476be2651433e68)
- [Tugende](https://etherscan.io/address/0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65)
- [Oya, via Almavest](https://etherscan.io/address/0xC13465CE9Ae3Aa184eB536F04FDc3f54D2dEf277)
- [Almavest Basket #3](https://etherscan.io/address/0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5)
- [Almavest Basket #2](https://etherscan.io/address/0xe32c22e4D95caE1fB805C60C9e0026ed57971BCf)
- [QuickCheck #1](https://etherscan.io/address/0xd798d527F770ad920BB50680dBC202bB0a1DaFD6)
- [Aspire #2](https://etherscan.io/address/0x9e8B9182ABbA7b4C188C979bC8F4C79F7f4c90d3)
- [QuickCheck #2](https://etherscan.io/address/0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c)
- [QuickCheck #3](https://etherscan.io/address/0x1cc90f7bb292dab6fa4398f3763681cfe497db97)
- [Aspire #1](https://etherscan.io/address/0x3634855ec1beaf6f9be0f7d2f67fc9cb5f4eeea4)
- [Almavest Basket #1](https://etherscan.io/address/0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1)
- [Aspire #3](https://etherscan.io/address/0x8bbd80F88e662e56B918c353DA635E210ECe93C6)
- [PayJoy](https://etherscan.io/address/0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7)

### config

```solidity
contract GoldfinchConfig config
```

### LOCKER_ROLE

```solidity
bytes32 LOCKER_ROLE
```

### SENIOR_ROLE

```solidity
bytes32 SENIOR_ROLE
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

### creditLine

```solidity
contract ICreditLine creditLine
```

Pool's credit line, responsible for managing the loan's accounting variables

### createdAt

```solidity
uint256 createdAt
```

Time when the pool was initialized. Zero if uninitialized

### juniorFeePercent

```solidity
uint256 juniorFeePercent
```

### drawdownsPaused

```solidity
bool drawdownsPaused
```

### allowedUIDTypes

```solidity
uint256[] allowedUIDTypes
```

### totalDeployed

```solidity
uint256 totalDeployed
```

### fundableAt

```solidity
uint256 fundableAt
```

### _poolSlices

```solidity
mapping(uint256 => struct ITranchedPool.PoolSlice) _poolSlices
```

### numSlices

```solidity
uint256 numSlices
```

Get the current number of slices for this pool

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |

### initialize

```solidity
function initialize(address _config, address _borrower, uint256 _juniorFeePercent, uint256 _limit, uint256 _interestApr, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) public
```

Initialize the pool. Can only be called once, and should be called in the same transaction as
  contract creation to avoid initialization front-running

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | address | address of GoldfinchConfig |
| _borrower | address | address of borrower, a non-transferrable role for performing privileged actions like   drawdown |
| _juniorFeePercent | uint256 | percent (whole number) of senior interest that gets re-allocated to the junior tranche.   valid range is [0, 100] |
| _limit | uint256 | the max USDC amount that can be drawn down across all pool slices |
| _interestApr | uint256 | interest rate for the loan |
| _schedule | contract ISchedule |  |
| _lateFeeApr | uint256 | late fee interest rate for the loan, which kicks in `LatenessGracePeriodInDays` days after a   payment becomes late |
| _fundableAt | uint256 | earliest time at which the first slice can be funded |
| _allowedUIDTypes | uint256[] |  |

### setAllowedUIDTypes

```solidity
function setAllowedUIDTypes(uint256[] ids) external
```

### getAllowedUIDTypes

```solidity
function getAllowedUIDTypes() external view returns (uint256[])
```

### assess

```solidity
function assess() external
```

Intentionable no-op. Included to be compatible with the v1 pool interface

### deposit

```solidity
function deposit(uint256 tranche, uint256 amount) public returns (uint256)
```

Supply capital to this pool. Caller can't deposit to the junior tranche if the junior pool is locked.
  Caller can't deposit to a senior tranche if the pool is locked. Caller can't deposit if they are missing the
  required UID NFT.

_TL: tranche locked
IA: invalid amount
NA: not authorized. Must have correct UID or be go listed_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 | id of tranche to supply capital to. Id must correspond to a tranche in the current slice. |
| amount | uint256 | amount of capital to supply |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### depositWithPermit

```solidity
function depositWithPermit(uint256 tranche, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public returns (uint256 tokenId)
```

### withdraw

```solidity
function withdraw(uint256 tokenId, uint256 amount) public returns (uint256, uint256)
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
function withdrawMultiple(uint256[] tokenIds, uint256[] amounts) public
```

Withdraw from multiple tokens

_LEN: argument length mismatch_

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

_DP: drawdowns paused
IF: insufficient funds_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC to drawdown. This amount is transferred to the caller |

### NUM_TRANCHES_PER_SLICE

```solidity
function NUM_TRANCHES_PER_SLICE() external pure returns (uint256)
```

### lockJuniorCapital

```solidity
function lockJuniorCapital() external
```

Lock the junior capital in the junior tranche of the current slice. The capital is locked for
  `DrawdownPeriodInSeconds` seconds and gives the senior pool time to decide how much to invest (ensure
  leverage ratio cannot change for the period). During this period the borrower has the option to lock
  the senior capital by calling `lockPool()`. Backers may withdraw their junior capital if the the senior
  tranche has not been locked and the drawdown period has ended. Only the borrower can call this function.

### lockPool

```solidity
function lockPool() external
```

Lock the senior capital in the senior tranche of the current slice and reset the lock period of
  the junior capital to match the senior capital lock period. During this period the borrower has the
  option to draw down the pool. Beyond the drawdown period any unused capital is available to withdraw by
  all depositors.

### setFundableAt

```solidity
function setFundableAt(uint256 newFundableAt) external
```

Update `fundableAt` to a new timestamp. Only the borrower can call this.

### initializeNextSlice

```solidity
function initializeNextSlice(uint256 _fundableAt) external
```

Initialize the next slice for the pool. Enables backers and the senior pool to provide additional
  capital to the borrower.

_NL: not locked
LP: late payment
GP: beyond principal grace period_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fundableAt | uint256 | time at which the new slice (now the current slice) becomes fundable |

### getAmountsOwed

```solidity
function getAmountsOwed(uint256 timestamp) external view returns (uint256 interestOwed, uint256 interestAccrued, uint256 principalOwed)
```

Compute interest and principal owed on the current balance at a future timestamp

_IT: invalid timestamp
LI: loan inactive_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | time to calculate up to |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| interestOwed | uint256 | amount of obligated interest owed at `timestamp` |
| interestAccrued | uint256 | amount of accrued interest (not yet owed) that can be paid at `timestamp` |
| principalOwed | uint256 | amount of principal owed at `timestamp` |

### pay

```solidity
function pay(uint256 amount) external returns (struct ILoan.PaymentAllocation)
```

Pay down interest + principal. Excess payments are refunded to the caller

_ZA: zero amount_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC amount to pay |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | PaymentAllocation info on how the payment was allocated |

### pay

```solidity
function pay(uint256 principalAmount, uint256 interestAmount) external returns (struct ILoan.PaymentAllocation)
```

Pay down the credit line, separating the principal and interest payments. You must pay back all interest
  before paying back principal. Excess payments are refunded to the caller

_ZA: zero amount_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| principalAmount | uint256 |  |
| interestAmount | uint256 |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | PaymentAllocation info on how the payment was allocated |

### emergencyShutdown

```solidity
function emergencyShutdown() public
```

Pauses the pool and sweeps any remaining funds to the treasury reserve.

### pauseDrawdowns

```solidity
function pauseDrawdowns() public
```

Pauses all drawdowns (but not deposits/withdraws)

### unpauseDrawdowns

```solidity
function unpauseDrawdowns() public
```

Unpause drawdowns

### setLimit

```solidity
function setLimit(uint256 newAmount) external
```

### setMaxLimit

```solidity
function setMaxLimit(uint256 newAmount) external
```

### getTranche

```solidity
function getTranche(uint256 tranche) public view returns (struct ITranchedPool.TrancheInfo)
```

TrancheInfo for tranche with id `trancheId`. The senior tranche of slice i has id 2*(i-1)+1. The
  junior tranche of slice i has id 2*i. Slice indices start at 1.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 |  |

### poolSlices

```solidity
function poolSlices(uint256 index) external view returns (struct ITranchedPool.PoolSlice)
```

Get a slice by index

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | of slice. Valid indices are on the interval [0, numSlices - 1] |

### totalJuniorDeposits

```solidity
function totalJuniorDeposits() external view returns (uint256)
```

Query the total capital supplied to the pool's junior tranches

### getLoanType

```solidity
function getLoanType() external view returns (enum LoanType)
```

getLoanType was added to support the new callable loan type.
        It is not supported in older versions of ILoan (e.g. legacy TranchedPools)

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
function _pay(uint256 principalPayment, uint256 interestPayment) internal returns (struct ILoan.PaymentAllocation)
```

_NL: not locked_

### _pay

```solidity
function _pay(uint256 paymentAmount) internal returns (struct ILoan.PaymentAllocation)
```

### distributeToSlicesAndAllocateBackerRewards

```solidity
function distributeToSlicesAndAllocateBackerRewards(uint256 interestAccrued, struct ILoan.PaymentAllocation pa) internal
```

### _collectInterestAndPrincipal

```solidity
function _collectInterestAndPrincipal(uint256 interest, uint256 principal) internal returns (uint256)
```

### _createAndSetCreditLine

```solidity
function _createAndSetCreditLine(address _borrower, uint256 _maxLimit, uint256 _interestApr, contract ISchedule _schedule, uint256 _lateFeeApr) internal
```

### _withdraw

```solidity
function _withdraw(struct ITranchedPool.TrancheInfo trancheInfo, struct IPoolTokens.TokenInfo tokenInfo, uint256 tokenId, uint256 amount) internal returns (uint256, uint256)
```

_ZA: Zero amount
IA: Invalid amount - amount too large
TL: Tranched Locked_

### _lockJuniorCapital

```solidity
function _lockJuniorCapital(uint256 sliceId) internal
```

_TL: tranch locked or has been locked before_

### _lockPool

```solidity
function _lockPool() internal
```

_NL: Not locked
TL: tranche locked. The senior pool has already been locked._

### _initializeNextSlice

```solidity
function _initializeNextSlice(uint256 newFundableAt) internal
```

_SL: slice limit_

### _locked

```solidity
function _locked() internal view returns (bool)
```

### _getTrancheInfo

```solidity
function _getTrancheInfo(uint256 trancheId) internal view returns (struct ITranchedPool.TrancheInfo)
```

### getVersion

```solidity
function getVersion() external pure returns (uint8[3] version)
```

Returns the version triplet `[major, minor, patch]`

### onlyLocker

```solidity
modifier onlyLocker()
```

_NA: not authorized. not locker_

