## TranchedPool

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x38Dd72b21cBB6023b9818060c541D2Ce7D4D107b

**Borrower Pool deployments on Ethereum mainnet: **

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

### FP_SCALING_FACTOR

```solidity
uint256 FP_SCALING_FACTOR
```

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### ONE_HUNDRED

```solidity
uint256 ONE_HUNDRED
```

### NUM_TRANCHES_PER_SLICE

```solidity
uint256 NUM_TRANCHES_PER_SLICE
```

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

### poolSlices

```solidity
struct ITranchedPool.PoolSlice[] poolSlices
```

### DepositMade

```solidity
event DepositMade(address owner, uint256 tranche, uint256 tokenId, uint256 amount)
```

### WithdrawalMade

```solidity
event WithdrawalMade(address owner, uint256 tranche, uint256 tokenId, uint256 interestWithdrawn, uint256 principalWithdrawn)
```

### TranchedPoolAssessed

```solidity
event TranchedPoolAssessed(address pool)
```

### PaymentApplied

```solidity
event PaymentApplied(address payer, address pool, uint256 interestAmount, uint256 principalAmount, uint256 remainingAmount, uint256 reserveAmount)
```

### SharePriceUpdated

```solidity
event SharePriceUpdated(address pool, uint256 tranche, uint256 principalSharePrice, int256 principalDelta, uint256 interestSharePrice, int256 interestDelta)
```

### ReserveFundsCollected

```solidity
event ReserveFundsCollected(address from, uint256 amount)
```

### CreditLineMigrated

```solidity
event CreditLineMigrated(address oldCreditLine, address newCreditLine)
```

### DrawdownMade

```solidity
event DrawdownMade(address borrower, uint256 amount)
```

### DrawdownsPaused

```solidity
event DrawdownsPaused(address pool)
```

### DrawdownsUnpaused

```solidity
event DrawdownsUnpaused(address pool)
```

### EmergencyShutdown

```solidity
event EmergencyShutdown(address pool)
```

### TrancheLocked

```solidity
event TrancheLocked(address pool, uint256 trancheId, uint256 lockedUntil)
```

### SliceCreated

```solidity
event SliceCreated(address pool, uint256 sliceId)
```

### initialize

```solidity
function initialize(address _config, address _borrower, uint256 _juniorFeePercent, uint256 _limit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays, uint256 _fundableAt, uint256[] _allowedUIDTypes) public
```

### setAllowedUIDTypes

```solidity
function setAllowedUIDTypes(uint256[] ids) public
```

### getAllowedUIDTypes

```solidity
function getAllowedUIDTypes() public view returns (uint256[])
```

### deposit

```solidity
function deposit(uint256 tranche, uint256 amount) public returns (uint256 tokenId)
```

Deposit a USDC amount into the pool for a tranche. Mints an NFT to the caller representing the position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tranche | uint256 | The number representing the tranche to deposit into |
| amount | uint256 | The USDC amount to tranfer from the caller to the pool |

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId of the NFT |

### depositWithPermit

```solidity
function depositWithPermit(uint256 tranche, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public returns (uint256 tokenId)
```

### withdraw

```solidity
function withdraw(uint256 tokenId, uint256 amount) public returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
```

Withdraw an already deposited amount if the funds are available

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The NFT representing the position |
| amount | uint256 | The amount to withdraw (must be &lt;&#x3D; interest+principal currently available to withdraw) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| interestWithdrawn | uint256 | The interest amount that was withdrawn |
| principalWithdrawn | uint256 | The principal amount that was withdrawn |

### withdrawMultiple

```solidity
function withdrawMultiple(uint256[] tokenIds, uint256[] amounts) public
```

Withdraw from many tokens (that the sender owns) in a single transaction

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | An array of tokens ids representing the position |
| amounts | uint256[] | An array of amounts to withdraw from the corresponding tokenIds |

### withdrawMax

```solidity
function withdrawMax(uint256 tokenId) external returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
```

Similar to withdraw but will withdraw all available funds

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The NFT representing the position |

| Name | Type | Description |
| ---- | ---- | ----------- |
| interestWithdrawn | uint256 | The interest amount that was withdrawn |
| principalWithdrawn | uint256 | The principal amount that was withdrawn |

### drawdown

```solidity
function drawdown(uint256 amount) external
```

Draws down the funds (and locks the pool) to the borrower address. Can only be called by the borrower

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to drawdown from the creditline (must be &lt; limit) |

### lockJuniorCapital

```solidity
function lockJuniorCapital() external
```

Locks the junior tranche, preventing more junior deposits. Gives time for the senior to determine how
much to invest (ensure leverage ratio cannot change for the period)

### lockPool

```solidity
function lockPool() external
```

Locks the pool (locks both senior and junior tranches and starts the drawdown period). Beyond the drawdown
period, any unused capital is available to withdraw by all depositors

### setFundableAt

```solidity
function setFundableAt(uint256 newFundableAt) external
```

### initializeNextSlice

```solidity
function initializeNextSlice(uint256 _fundableAt) external
```

### assess

```solidity
function assess() external
```

Triggers an assessment of the creditline and the applies the payments according the tranche waterfall

### pay

```solidity
function pay(uint256 amount) external
```

Allows repaying the creditline. Collects the USDC amount from the sender and triggers an assess

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to repay |

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

### migrateCreditLine

```solidity
function migrateCreditLine(address _borrower, uint256 _maxLimit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays) public
```

Migrates the accounting variables from the current creditline to a brand new one

| Name | Type | Description |
| ---- | ---- | ----------- |
| _borrower | address | The borrower address |
| _maxLimit | uint256 | The new max limit |
| _interestApr | uint256 | The new interest APR |
| _paymentPeriodInDays | uint256 | The new payment period in days |
| _termInDays | uint256 | The new term in days |
| _lateFeeApr | uint256 | The new late fee APR |
| _principalGracePeriodInDays | uint256 |  |

### migrateAndSetNewCreditLine

```solidity
function migrateAndSetNewCreditLine(address newCl) public
```

Migrates to a new creditline without copying the accounting variables

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

### numSlices

```solidity
function numSlices() public view returns (uint256)
```

### usdcToSharePrice

```solidity
function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256)
```

Converts USDC amounts to share price

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The USDC amount to convert |
| totalShares | uint256 | The total shares outstanding |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The share price of the input amount |

### sharePriceToUsdc

```solidity
function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256)
```

Converts share price to USDC amounts

| Name | Type | Description |
| ---- | ---- | ----------- |
| sharePrice | uint256 | The share price to convert |
| totalShares | uint256 | The total shares outstanding |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The USDC amount of the input share price |

### totalJuniorDeposits

```solidity
function totalJuniorDeposits() external view returns (uint256)
```

Returns the total junior capital deposited

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The total USDC amount deposited into all junior tranches |

### availableToWithdraw

```solidity
function availableToWithdraw(uint256 tokenId) public view returns (uint256 interestRedeemable, uint256 principalRedeemable)
```

Determines the amount of interest and principal redeemable by a particular tokenId

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token representing the position |

| Name | Type | Description |
| ---- | ---- | ----------- |
| interestRedeemable | uint256 | The interest available to redeem |
| principalRedeemable | uint256 | The principal available to redeem |

### _withdraw

```solidity
function _withdraw(struct ITranchedPool.TrancheInfo trancheInfo, struct IPoolTokens.TokenInfo tokenInfo, uint256 tokenId, uint256 amount) internal returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
```

### _isSeniorTrancheId

```solidity
function _isSeniorTrancheId(uint256 trancheId) internal pure returns (bool)
```

### redeemableInterestAndPrincipal

```solidity
function redeemableInterestAndPrincipal(struct ITranchedPool.TrancheInfo trancheInfo, struct IPoolTokens.TokenInfo tokenInfo) internal view returns (uint256 interestRedeemable, uint256 principalRedeemable)
```

### _lockJuniorCapital

```solidity
function _lockJuniorCapital(uint256 sliceId) internal
```

### _lockPool

```solidity
function _lockPool() internal
```

### _initializeNextSlice

```solidity
function _initializeNextSlice(uint256 newFundableAt) internal
```

### collectInterestAndPrincipal

```solidity
function collectInterestAndPrincipal(address from, uint256 interest, uint256 principal) internal returns (uint256 totalReserveAmount)
```

### locked

```solidity
function locked() internal view returns (bool)
```

### createAndSetCreditLine

```solidity
function createAndSetCreditLine(address _borrower, uint256 _maxLimit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays) internal
```

### _getTrancheInfo

```solidity
function _getTrancheInfo(uint256 trancheId) internal view returns (struct ITranchedPool.TrancheInfo)
```

### currentTime

```solidity
function currentTime() internal view virtual returns (uint256)
```

### _sendToReserve

```solidity
function _sendToReserve(uint256 amount) internal
```

### _collectPayment

```solidity
function _collectPayment(uint256 amount) internal
```

### _assess

```solidity
function _assess() internal
```

### hasAllowedUID

```solidity
function hasAllowedUID(address sender) public view returns (bool)
```

### onlyLocker

```solidity
modifier onlyLocker()
```

