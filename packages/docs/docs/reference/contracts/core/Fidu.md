## Fidu

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF

Fidu (symbol: FIDU) is Goldfinch&#x27;s liquidity token, representing shares
 in the Pool. When you deposit, we mint a corresponding amount of Fidu, and when you withdraw, we
 burn Fidu. The share price of the Pool implicitly represents the &quot;exchange rate&quot; between Fidu
 and USDC (or whatever currencies the Pool may allow withdraws in during the future)

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### ASSET_LIABILITY_MATCH_THRESHOLD

```solidity
uint256 ASSET_LIABILITY_MATCH_THRESHOLD
```

### config

```solidity
contract GoldfinchConfig config
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### __initialize__

```solidity
function __initialize__(address owner, string name, string symbol, contract GoldfinchConfig _config) external
```

### mintTo

```solidity
function mintTo(address to, uint256 amount) public
```

_Creates &#x60;amount&#x60; new tokens for &#x60;to&#x60;.

See {ERC20-_mint}.

Requirements:

- the caller must have the &#x60;MINTER_ROLE&#x60;._

### burnFrom

```solidity
function burnFrom(address from, uint256 amount) public
```

_Destroys &#x60;amount&#x60; tokens from &#x60;account&#x60;, deducting from the caller&#x27;s
allowance.

See {ERC20-_burn} and {ERC20-allowance}.

Requirements:

- the caller must have the MINTER_ROLE_

### canMint

```solidity
function canMint(uint256 newAmount) internal view returns (bool)
```

### canBurn

```solidity
function canBurn(uint256 amountToBurn) internal view returns (bool)
```

### fiduToUSDC

```solidity
function fiduToUSDC(uint256 amount) internal pure returns (uint256)
```

### fiduMantissa

```solidity
function fiduMantissa() internal pure returns (uint256)
```

### usdcMantissa

```solidity
function usdcMantissa() internal pure returns (uint256)
```

### updateGoldfinchConfig

```solidity
function updateGoldfinchConfig() external
```

