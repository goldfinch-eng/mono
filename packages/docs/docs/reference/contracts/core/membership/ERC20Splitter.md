## IERC20SplitterReceiver

### onReceive

```solidity
function onReceive(uint256 amount) external returns (bytes4 retval)
```

## ERC20Splitter

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xE2da0Cf4DCEe902F74D4949145Ea2eC24F0718a4

Splits the ERC20 balance of this contract amongst a list of payees.
  Unlike similar splitter contracts, all shares of the balance are distributed
  in a single `distribute` transaction. If a payee is a smart contract implementing
  `IERC20SplitterReceiver`, then its `onReceive` handler function will be called
  after it receives its share.

### LengthMismatch

```solidity
error LengthMismatch()
```

### InvalidReceiver

```solidity
error InvalidReceiver()
```

### IntraBlockDistribution

```solidity
error IntraBlockDistribution()
```

### Distributed

```solidity
event Distributed(uint256 total)
```

### PayeeAdded

```solidity
event PayeeAdded(address payee, uint256 share)
```

### totalShares

```solidity
uint256 totalShares
```

The total number of shares in the splitter. A payee's proportion
  of the split can be calculated as its share / totalShares.

### payees

```solidity
address[] payees
```

A list of payees

### shares

```solidity
mapping(address => uint256) shares
```

Payee shares

### erc20

```solidity
contract IERC20 erc20
```

The ERC20 that is distributed to payees

### lastDistributionAt

```solidity
uint256 lastDistributionAt
```

The block.timestamp when `distribute` was last called

### constructor

```solidity
constructor(contract Context _context, contract IERC20 _erc20) public
```

### initialize

```solidity
function initialize() external
```

### pendingDistributionFor

```solidity
function pendingDistributionFor(address payee) external view returns (uint256)
```

### distribute

```solidity
function distribute() external
```

Distribute the current balance to payees. If a payee is a smart contract
  implementing `IERC20SplitterReceiver`, then its `onReceive` handler function will
  be called after it receives its share.

### triggerOnReceive

```solidity
function triggerOnReceive(address payee, uint256 amount) internal
```

### replacePayees

```solidity
function replacePayees(address[] _payees, uint256[] _shares) external
```

Replace all current payees with a new set of payees and shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _payees | address[] | An array of addresses to receive distributions |
| _shares | uint256[] | An array of shares (ordered by `_payees`) to use for distributions |

### _setUpPayees

```solidity
function _setUpPayees(address[] _payees, uint256[] _shares) internal
```

