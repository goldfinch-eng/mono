## HasAdmin

Base contract that provides an OWNER_ROLE and convenience function/modifier for
  checking sender against this role. Inherting contracts must set up this role using
  `_setupRole` and `_setRoleAdmin`.

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

ID for OWNER_ROLE

### isAdmin

```solidity
function isAdmin() public view returns (bool)
```

Determine whether msg.sender has OWNER_ROLE

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isAdmin True when msg.sender has OWNER_ROLE |

### onlyAdmin

```solidity
modifier onlyAdmin()
```

