## Pool

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75

Main entry point for LP&#x27;s (a.k.a. capital providers)
 Handles key logic for depositing and withdrawing funds from the Pool

### config

```solidity
contract GoldfinchConfig config
```

### compoundBalance

```solidity
uint256 compoundBalance
```

### DepositMade

```solidity
event DepositMade(address capitalProvider, uint256 amount, uint256 shares)
```

### WithdrawalMade

```solidity
event WithdrawalMade(address capitalProvider, uint256 userAmount, uint256 reserveAmount)
```

### TransferMade

```solidity
event TransferMade(address from, address to, uint256 amount)
```

### InterestCollected

```solidity
event InterestCollected(address payer, uint256 poolAmount, uint256 reserveAmount)
```

### PrincipalCollected

```solidity
event PrincipalCollected(address payer, uint256 amount)
```

### ReserveFundsCollected

```solidity
event ReserveFundsCollected(address user, uint256 amount)
```

### PrincipalWrittendown

```solidity
event PrincipalWrittendown(address creditline, int256 amount)
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

Run only once, on initialization

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address of who should have the &quot;OWNER_ROLE&quot; of this contract |
| _config | contract GoldfinchConfig | The address of the GoldfinchConfig contract |

### deposit

```solidity
function deposit(uint256 amount) external
```

Deposits &#x60;amount&#x60; USDC from msg.sender into the Pool, and returns you the equivalent value of FIDU tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of USDC to deposit |

### withdraw

```solidity
function withdraw(uint256 usdcAmount) external
```

Withdraws USDC from the Pool to msg.sender, and burns the equivalent value of FIDU tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to withdraw |

### withdrawInFidu

```solidity
function withdrawInFidu(uint256 fiduAmount) external
```

Withdraws USDC (denominated in FIDU terms) from the Pool to msg.sender

| Name | Type | Description |
| ---- | ---- | ----------- |
| fiduAmount | uint256 | The amount of USDC to withdraw in terms of fidu shares |

### collectInterestAndPrincipal

```solidity
function collectInterestAndPrincipal(address from, uint256 interest, uint256 principal) public
```

Collects &#x60;interest&#x60; USDC in interest and &#x60;principal&#x60; in principal from &#x60;from&#x60; and sends it to the Pool.
 This also increases the share price accordingly. A portion is sent to the Goldfinch Reserve address

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address to take the USDC from. Implicitly, the Pool  must be authorized to move USDC on behalf of &#x60;from&#x60;. |
| interest | uint256 | the interest amount of USDC to move to the Pool |
| principal | uint256 | the principal amount of USDC to move to the Pool Requirements:  - The caller must be the Credit Desk. Not even the owner can call this function. |

### distributeLosses

```solidity
function distributeLosses(address creditlineAddress, int256 writedownDelta) external
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) public returns (bool)
```

Moves &#x60;amount&#x60; USDC from &#x60;from&#x60;, to &#x60;to&#x60;.

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address to take the USDC from. Implicitly, the Pool  must be authorized to move USDC on behalf of &#x60;from&#x60;. |
| to | address | The address that the USDC should be moved to |
| amount | uint256 | the amount of USDC to move to the Pool Requirements:  - The caller must be the Credit Desk. Not even the owner can call this function. |

### drawdown

```solidity
function drawdown(address to, uint256 amount) public returns (bool)
```

Moves &#x60;amount&#x60; USDC from the pool, to &#x60;to&#x60;. This is similar to transferFrom except we sweep any
balance we have from compound first and recognize interest. Meant to be called only by the credit desk on drawdown

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that the USDC should be moved to |
| amount | uint256 | the amount of USDC to move to the Pool Requirements:  - The caller must be the Credit Desk. Not even the owner can call this function. |

### assets

```solidity
function assets() public view returns (uint256)
```

### migrateToSeniorPool

```solidity
function migrateToSeniorPool() external
```

### toUint256

```solidity
function toUint256(bytes _bytes) internal pure returns (uint256 value)
```

### sweepToCompound

```solidity
function sweepToCompound() public
```

Moves any USDC still in the Pool to Compound, and tracks the amount internally.
This is done to earn interest on latent funds until we have other borrowers who can use it.

Requirements:
 - The caller must be an admin.

### sweepFromCompound

```solidity
function sweepFromCompound() public
```

Moves any USDC from Compound back to the Pool, and recognizes interest earned.
This is done automatically on drawdown or withdraw, but can be called manually if necessary.

Requirements:
 - The caller must be an admin.

### _withdraw

```solidity
function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal
```

### sweepToCompound

```solidity
function sweepToCompound(contract ICUSDCContract cUSDC, uint256 usdcAmount) internal
```

### sweepFromCompound

```solidity
function sweepFromCompound(contract ICUSDCContract cUSDC, uint256 cUSDCAmount) internal
```

### _collectInterestAndPrincipal

```solidity
function _collectInterestAndPrincipal(address from, uint256 interest, uint256 principal) internal
```

### _sweepFromCompound

```solidity
function _sweepFromCompound() internal
```

### fiduMantissa

```solidity
function fiduMantissa() internal pure returns (uint256)
```

### usdcMantissa

```solidity
function usdcMantissa() internal pure returns (uint256)
```

### usdcToFidu

```solidity
function usdcToFidu(uint256 amount) internal pure returns (uint256)
```

### cUSDCToUSDC

```solidity
function cUSDCToUSDC(uint256 exchangeRate, uint256 amount) internal pure returns (uint256)
```

### totalShares

```solidity
function totalShares() internal view returns (uint256)
```

### usdcToSharePrice

```solidity
function usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256)
```

### poolWithinLimit

```solidity
function poolWithinLimit(uint256 _totalShares) internal view returns (bool)
```

### transactionWithinLimit

```solidity
function transactionWithinLimit(uint256 amount) internal view returns (bool)
```

### getNumShares

```solidity
function getNumShares(uint256 amount) internal view returns (uint256)
```

### getUSDCAmountFromShares

```solidity
function getUSDCAmountFromShares(uint256 fiduAmount) internal view returns (uint256)
```

### fiduToUSDC

```solidity
function fiduToUSDC(uint256 amount) internal pure returns (uint256)
```

### sendToReserve

```solidity
function sendToReserve(address from, uint256 amount, address userForEvent) internal
```

### doUSDCTransfer

```solidity
function doUSDCTransfer(address from, address to, uint256 amount) internal returns (bool)
```

### withinTransactionLimit

```solidity
modifier withinTransactionLimit(uint256 amount)
```

### onlyCreditDesk

```solidity
modifier onlyCreditDesk()
```

