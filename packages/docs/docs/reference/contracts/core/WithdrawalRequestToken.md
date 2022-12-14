## WithdrawalRequestToken

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xc84D4a45d1d7EB307BBDeA94b282bEE9892bd523

### config

```solidity
contract GoldfinchConfig config
```

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) external
```

### mint

```solidity
function mint(address receiver) external returns (uint256)
```

Can only be called by senior pool or protocol admin

_succeeds if and only if called by senior pool_

### burn

```solidity
function burn(uint256 tokenId) external
```

Burn token `tokenId`

_suceeds if and only if called by senior pool_

### approve

```solidity
function approve(address, uint256) public
```

Disabled

### setApprovalForAll

```solidity
function setApprovalForAll(address, bool) public
```

Disabled

### transferFrom

```solidity
function transferFrom(address, address, uint256) public
```

Disabled

### safeTransferFrom

```solidity
function safeTransferFrom(address, address, uint256) public
```

Disabled

### safeTransferFrom

```solidity
function safeTransferFrom(address, address, uint256, bytes) public
```

Disabled

### onlySeniorPool

```solidity
modifier onlySeniorPool()
```

