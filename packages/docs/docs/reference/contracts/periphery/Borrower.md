## Borrower

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xB8276651612df04E48DA5f353c969aa1C0076099

These contracts represent the a convenient way for a borrower to interact with Goldfinch
 They are 100% optional. However, they let us add many sophisticated and convient features for borrowers
 while still keeping our core protocol small and secure. We therefore expect most borrowers will use them.
 This contract is the "official" borrower contract that will be maintained by Goldfinch governance. However,
 in theory, anyone can fork or create their own version, or not use any contract at all. The core functionality
 is completely agnostic to whether it is interacting with a contract or an externally owned account (EOA).

### config

```solidity
contract GoldfinchConfig config
```

### USDT_ADDRESS

```solidity
address USDT_ADDRESS
```

### BUSD_ADDRESS

```solidity
address BUSD_ADDRESS
```

### GUSD_ADDRESS

```solidity
address GUSD_ADDRESS
```

### DAI_ADDRESS

```solidity
address DAI_ADDRESS
```

### initialize

```solidity
function initialize(address owner, address _config) external
```

### lockJuniorCapital

```solidity
function lockJuniorCapital(address poolAddress) external
```

### lockPool

```solidity
function lockPool(address poolAddress) external
```

### drawdown

```solidity
function drawdown(address poolAddress, uint256 amount, address addressToSendTo) external
```

Allows a borrower to drawdown on their credit line through a TranchedPool.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | The creditline from which they would like to drawdown |
| amount | uint256 | The amount, in USDC atomic units, that a borrower wishes to drawdown |
| addressToSendTo | address | The address where they would like the funds sent. If the zero address is passed,  it will be defaulted to the contracts address (msg.sender). This is a convenience feature for when they would  like the funds sent to an exchange or alternate wallet, different from the authentication address |

### drawdownWithSwapOnOneInch

```solidity
function drawdownWithSwapOnOneInch(address poolAddress, uint256 amount, address addressToSendTo, address toToken, uint256 minTargetAmount, uint256[] exchangeDistribution) public
```

### transferERC20

```solidity
function transferERC20(address token, address to, uint256 amount) public
```

### pay

```solidity
function pay(address poolAddress, uint256 amount) external
```

Allows a borrower to pay back loans by calling the `pay` function directly on a TranchedPool

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | The credit line to be paid back |
| amount | uint256 | The amount, in USDC atomic units, that the borrower wishes to pay |

### payMultiple

```solidity
function payMultiple(address[] pools, uint256[] amounts) external
```

### payInFull

```solidity
function payInFull(address poolAddress, uint256 amount) external
```

### payWithSwapOnOneInch

```solidity
function payWithSwapOnOneInch(address poolAddress, uint256 originAmount, address fromToken, uint256 minTargetAmount, uint256[] exchangeDistribution) external
```

### payMultipleWithSwapOnOneInch

```solidity
function payMultipleWithSwapOnOneInch(address[] pools, uint256[] minAmounts, uint256 originAmount, address fromToken, uint256[] exchangeDistribution) external
```

### _transferAndPay

```solidity
function _transferAndPay(contract IERC20withDec usdc, address poolAddress, uint256 amount) internal
```

### transferFrom

```solidity
function transferFrom(address erc20, address sender, address recipient, uint256 amount) internal
```

### swapOnOneInch

```solidity
function swapOnOneInch(address fromToken, address toToken, uint256 originAmount, uint256 minTargetAmount, uint256[] exchangeDistribution) internal
```

### _invoke

```solidity
function _invoke(address _target, bytes _data) internal returns (bytes)
```

Performs a generic transaction.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _target | address | The address for the transaction. |
| _data | bytes | The data of the transaction. Mostly copied from Argent: https://github.com/argentlabs/argent-contracts/blob/develop/contracts/wallet/BaseWallet.sol#L111 |

### _toUint256

```solidity
function _toUint256(bytes _bytes) internal pure returns (uint256 value)
```

### _msgSender

```solidity
function _msgSender() internal view returns (address payable)
```

### _msgData

```solidity
function _msgData() internal view returns (bytes ret)
```

### versionRecipient

```solidity
function versionRecipient() external view returns (string)
```

