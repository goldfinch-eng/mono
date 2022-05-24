## TransferRestrictedVault

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### config

```solidity
contract GoldfinchConfig config
```

### PoolTokenPosition

```solidity
struct PoolTokenPosition {
  uint256 tokenId;
  uint256 lockedUntil;
}
```

### FiduPosition

```solidity
struct FiduPosition {
  uint256 amount;
  uint256 lockedUntil;
}
```

### poolTokenPositions

```solidity
mapping(uint256 &#x3D;&gt; struct TransferRestrictedVault.PoolTokenPosition) poolTokenPositions
```

### fiduPositions

```solidity
mapping(uint256 &#x3D;&gt; struct TransferRestrictedVault.FiduPosition) fiduPositions
```

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) external
```

### depositJunior

```solidity
function depositJunior(contract ITranchedPool tranchedPool, uint256 amount) public
```

### depositJuniorWithPermit

```solidity
function depositJuniorWithPermit(contract ITranchedPool tranchedPool, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public
```

### depositSenior

```solidity
function depositSenior(uint256 amount) public
```

### depositSeniorWithPermit

```solidity
function depositSeniorWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public
```

### withdrawSenior

```solidity
function withdrawSenior(uint256 tokenId, uint256 usdcAmount) public
```

### withdrawSeniorInFidu

```solidity
function withdrawSeniorInFidu(uint256 tokenId, uint256 shares) public
```

### withdrawJunior

```solidity
function withdrawJunior(uint256 tokenId, uint256 amount) public returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
```

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual
```

_See {ERC721-_beforeTokenTransfer}.

Requirements:

- the contract must not be paused._

### transferPosition

```solidity
function transferPosition(uint256 tokenId, address to) public
```

_This method assumes that positions are mutually exclusive i.e. that the token
 represents a position in either PoolTokens or Fidu, but not both._

### _transferPoolTokenPosition

```solidity
function _transferPoolTokenPosition(struct TransferRestrictedVault.PoolTokenPosition position, address to) internal
```

### _transferFiduPosition

```solidity
function _transferFiduPosition(struct TransferRestrictedVault.FiduPosition position, address to) internal
```

### _approveSpender

```solidity
function _approveSpender(address spender, uint256 allowance) internal
```

### onlyTokenOwner

```solidity
modifier onlyTokenOwner(uint256 tokenId)
```

