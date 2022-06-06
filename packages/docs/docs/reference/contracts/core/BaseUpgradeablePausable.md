## BaseUpgradeablePausable

This is our Base contract that most other contracts inherit from. It includes many standard
 useful abilities like upgradeability, pausability, access control, and re-entrancy guards.

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### __gap1

```solidity
uint256[50] __gap1
```

### __gap2

```solidity
uint256[50] __gap2
```

### __gap3

```solidity
uint256[50] __gap3
```

### __gap4

```solidity
uint256[50] __gap4
```

### __BaseUpgradeablePausable__init

```solidity
function __BaseUpgradeablePausable__init(address owner) public
```

### isAdmin

```solidity
function isAdmin() public view returns (bool)
```

### onlyAdmin

```solidity
modifier onlyAdmin()
```

