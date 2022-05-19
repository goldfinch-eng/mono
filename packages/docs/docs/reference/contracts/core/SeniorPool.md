## SeniorPool

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822

Main entry point for senior LPs (a.k.a. capital providers)
 Automatically invests across borrower pools using an adjustable strategy.

### config

```solidity
contract GoldfinchConfig config
```

### ZAPPER_ROLE

```solidity
bytes32 ZAPPER_ROLE
```

### compoundBalance

```solidity
uint256 compoundBalance
```

### writedowns

```solidity
mapping(contract ITranchedPool &#x3D;&gt; uint256) writedowns
```

### DepositMade

```solidity
event DepositMade(address capitalProvider, uint256 amount, uint256 shares)
```

### WithdrawalMade

```solidity
event WithdrawalMade(address capitalProvider, uint256 userAmount, uint256 reserveAmount)
```

### InterestCollected

```solidity
event InterestCollected(address payer, uint256 amount)
```

### PrincipalCollected

```solidity
event PrincipalCollected(address payer, uint256 amount)
```

### ReserveFundsCollected

```solidity
event ReserveFundsCollected(address user, uint256 amount)
```

### PrincipalWrittenDown

```solidity
event PrincipalWrittenDown(address tranchedPool, int256 amount)
```

### InvestmentMadeInSenior

```solidity
event InvestmentMadeInSenior(address tranchedPool, uint256 amount)
```

### InvestmentMadeInJunior

```solidity
event InvestmentMadeInJunior(address tranchedPool, uint256 amount)
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### deposit

```solidity
function deposit(uint256 amount) public returns (uint256 depositShares)
```

Deposits &#x60;amount&#x60; USDC from msg.sender into the SeniorPool, and grants you the
 equivalent value of FIDU tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of USDC to deposit |

### depositWithPermit

```solidity
function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public returns (uint256 depositShares)
```

Identical to deposit, except it allows for a passed up signature to permit
 the Senior Pool to move funds on behalf of the user, all within one transaction.

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of USDC to deposit |
| deadline | uint256 |  |
| v | uint8 | secp256k1 signature component |
| r | bytes32 | secp256k1 signature component |
| s | bytes32 | secp256k1 signature component |

### withdraw

```solidity
function withdraw(uint256 usdcAmount) external returns (uint256 amount)
```

Withdraws USDC from the SeniorPool to msg.sender, and burns the equivalent value of FIDU tokens

| Name | Type | Description |
| ---- | ---- | ----------- |
| usdcAmount | uint256 | The amount of USDC to withdraw |

### withdrawInFidu

```solidity
function withdrawInFidu(uint256 fiduAmount) external returns (uint256 amount)
```

Withdraws USDC (denominated in FIDU terms) from the SeniorPool to msg.sender

| Name | Type | Description |
| ---- | ---- | ----------- |
| fiduAmount | uint256 | The amount of USDC to withdraw in terms of FIDU shares |

### updateGoldfinchConfig

```solidity
function updateGoldfinchConfig() external
```

Migrates to a new goldfinch config address

### sweepToCompound

```solidity
function sweepToCompound() public
```

Moves any USDC still in the SeniorPool to Compound, and tracks the amount internally.
This is done to earn interest on latent funds until we have other borrowers who can use it.

Requirements:
 - The caller must be an admin.

### sweepFromCompound

```solidity
function sweepFromCompound() public
```

Moves any USDC from Compound back to the SeniorPool, and recognizes interest earned.
This is done automatically on drawdown or withdraw, but can be called manually if necessary.

Requirements:
 - The caller must be an admin.

### invest

```solidity
function invest(contract ITranchedPool pool) public
```

Invest in an ITranchedPool&#x27;s senior tranche using the senior pool&#x27;s strategy

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | An ITranchedPool whose senior tranche should be considered for investment |

### estimateInvestment

```solidity
function estimateInvestment(contract ITranchedPool pool) public view returns (uint256)
```

### redeem

```solidity
function redeem(uint256 tokenId) public
```

Redeem interest and/or principal from an ITranchedPool investment

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | the ID of an IPoolTokens token to be redeemed |

### writedown

```solidity
function writedown(uint256 tokenId) public
```

Write down an ITranchedPool investment. This will adjust the senior pool&#x27;s share price
 down if we&#x27;re considering the investment a loss, or up if the borrower has subsequently
 made repayments that restore confidence that the full loan will be repaid.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | the ID of an IPoolTokens token to be considered for writedown |

### calculateWritedown

```solidity
function calculateWritedown(uint256 tokenId) public view returns (uint256)
```

Calculates the writedown amount for a particular pool position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token reprsenting the position |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount in dollars the principal should be written down by |

### assets

```solidity
function assets() public view returns (uint256)
```

Returns the net assests controlled by and owed to the pool

### getNumShares

```solidity
function getNumShares(uint256 amount) public view returns (uint256)
```

Converts and USDC amount to FIDU amount

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC amount to convert to FIDU |

### _calculateWritedown

```solidity
function _calculateWritedown(contract ITranchedPool pool, uint256 principal) internal view returns (uint256 writedownPercent, uint256 writedownAmount)
```

### currentTime

```solidity
function currentTime() internal view virtual returns (uint256)
```

### _distributeLosses

```solidity
function _distributeLosses(int256 writedownDelta) internal
```

### _fiduMantissa

```solidity
function _fiduMantissa() internal pure returns (uint256)
```

### _usdcMantissa

```solidity
function _usdcMantissa() internal pure returns (uint256)
```

### _usdcToFidu

```solidity
function _usdcToFidu(uint256 amount) internal pure returns (uint256)
```

### _fiduToUSDC

```solidity
function _fiduToUSDC(uint256 amount) internal pure returns (uint256)
```

### _getUSDCAmountFromShares

```solidity
function _getUSDCAmountFromShares(uint256 fiduAmount) internal view returns (uint256)
```

### _sharesWithinLimit

```solidity
function _sharesWithinLimit(uint256 _totalShares) internal view returns (bool)
```

### doUSDCTransfer

```solidity
function doUSDCTransfer(address from, address to, uint256 amount) internal returns (bool)
```

### _withdraw

```solidity
function _withdraw(uint256 usdcAmount, uint256 withdrawShares) internal returns (uint256 userAmount)
```

### _sweepToCompound

```solidity
function _sweepToCompound(contract ICUSDCContract cUSDC, uint256 usdcAmount) internal
```

### _sweepFromCompound

```solidity
function _sweepFromCompound() internal
```

### _sweepFromCompound

```solidity
function _sweepFromCompound(contract ICUSDCContract cUSDC, uint256 cUSDCAmount) internal
```

### _cUSDCToUSDC

```solidity
function _cUSDCToUSDC(uint256 exchangeRate, uint256 amount) internal pure returns (uint256)
```

### _collectInterestAndPrincipal

```solidity
function _collectInterestAndPrincipal(address from, uint256 interest, uint256 principal) internal
```

### _sendToReserve

```solidity
function _sendToReserve(uint256 amount, address userForEvent) internal
```

### _usdcToSharePrice

```solidity
function _usdcToSharePrice(uint256 usdcAmount) internal view returns (uint256)
```

### totalShares

```solidity
function totalShares() internal view returns (uint256)
```

### _isValidPool

```solidity
function _isValidPool(contract ITranchedPool pool) internal view returns (bool)
```

### _approvePool

```solidity
function _approvePool(contract ITranchedPool pool, uint256 allowance) internal
```

### isZapper

```solidity
function isZapper() public view returns (bool)
```

### initZapperRole

```solidity
function initZapperRole() external
```

### _sliceIndexToSeniorTrancheId

```solidity
function _sliceIndexToSeniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the senion tranche id for the given slice index

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | senior tranche id of given slice index |

