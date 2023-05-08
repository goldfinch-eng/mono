## GFI

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xdab396cCF3d84Cf2D07C4454e10C8A6F5b008D2b

GFI is Goldfinch's governance token.

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### PAUSER_ROLE

```solidity
bytes32 PAUSER_ROLE
```

### cap

```solidity
uint256 cap
```

The maximum number of tokens that can be minted

### CapUpdated

```solidity
event CapUpdated(address who, uint256 cap)
```

### constructor

```solidity
constructor(address owner, string name, string symbol, uint256 initialCap) public
```

### mint

```solidity
function mint(address account, uint256 amount) public
```

create and send tokens to a specified address

_this function will fail if the caller attempts to mint over the current cap_

### setCap

```solidity
function setCap(uint256 _cap) external
```

sets the maximum number of tokens that can be minted

_the cap must be greater than the current total supply_

### mintingAmountIsWithinCap

```solidity
function mintingAmountIsWithinCap(uint256 amount) internal view returns (bool)
```

### pause

```solidity
function pause() external
```

_Pauses all token transfers.

See {ERC20Pausable} and {Pausable-_pause}.

Requirements:

- the caller must have the `PAUSER_ROLE`._

### unpause

```solidity
function unpause() external
```

_Unpauses all token transfers.

See {ERC20Pausable} and {Pausable-_unpause}.

Requirements:

- the caller must have the `PAUSER_ROLE`._

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal
```

### onlyOwner

```solidity
modifier onlyOwner()
```

### onlyMinter

```solidity
modifier onlyMinter()
```

### onlyPauser

```solidity
modifier onlyPauser()
```

