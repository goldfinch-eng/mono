## Borrower

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xE1635F4F0EEE83C5E24023Ac7f8B9F2079fdD7d6

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

Drawdown on a loan

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | Pool to drawdown from |
| amount | uint256 | usdc amount to drawdown |
| addressToSendTo | address | Address to send the funds. Null address or address(this) will send funds back to the caller |

### drawdownWithSwapOnOneInch

```solidity
function drawdownWithSwapOnOneInch(address poolAddress, uint256 amount, address addressToSendTo, address toToken, uint256 minTargetAmount, uint256[] exchangeDistribution) public
```

Drawdown on a v1 or v2 pool and swap the usdc to the desired token using OneInch

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address |  |
| amount | uint256 | usdc amount to drawdown from the pool |
| addressToSendTo | address | address to send the `toToken` to |
| toToken | address | address of the ERC20 to swap to |
| minTargetAmount | uint256 | min amount of `toToken` you're willing to accept from the swap (i.e. a slippage tolerance) |
| exchangeDistribution | uint256[] |  |

### transferERC20

```solidity
function transferERC20(address token, address to, uint256 amount) public
```

### pay

```solidity
function pay(address poolAddress, uint256 amount) external
```

Pay back a v1 or v2 tranched pool

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | pool address |
| amount | uint256 | USDC amount to pay |

### payMultiple

```solidity
function payMultiple(address[] pools, uint256[] amounts) external
```

Pay back multiple pools. Supports v0.1.0 and v1.0.0 pools

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pools | address[] | list of pool addresses for which the caller is the borrower |
| amounts | uint256[] | amounts to pay back |

### pay

```solidity
function pay(address poolAddress, uint256 principalAmount, uint256 interestAmount) external
```

Pay back a v2.0.0 Tranched Pool

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address | The pool to be paid back |
| principalAmount | uint256 | principal amount to pay |
| interestAmount | uint256 | interest amount to pay |

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

### _pay

```solidity
function _pay(address poolAddress, uint256 amount) internal
```

### _payV2Separate

```solidity
function _payV2Separate(address poolAddress, uint256 principalAmount, uint256 interestAmount) internal returns (struct ILoan.PaymentAllocation)
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

