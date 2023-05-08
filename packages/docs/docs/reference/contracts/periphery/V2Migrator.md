## V2Migrator

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd44FE8Ec5D6cFB96A06e02e17bC109Ab98d506a5

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd44FE8Ec5D6cFB96A06e02e17bC109Ab98d506a5

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd44FE8Ec5D6cFB96A06e02e17bC109Ab98d506a5

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd44FE8Ec5D6cFB96A06e02e17bC109Ab98d506a5

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd44FE8Ec5D6cFB96A06e02e17bC109Ab98d506a5

This is a one-time use contract solely for the purpose of migrating from our V1
 to our V2 architecture. It will be temporarily granted authority from the Goldfinch governance,
 and then revokes it&#x27;s own authority and transfers it back to governance.

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### GO_LISTER_ROLE

```solidity
bytes32 GO_LISTER_ROLE
```

### config

```solidity
contract GoldfinchConfig config
```

### borrowerContracts

```solidity
mapping(address &#x3D;&gt; address) borrowerContracts
```

### CreditLineMigrated

```solidity
event CreditLineMigrated(address owner, address clToMigrate, address newCl, address tranchedPool)
```

### initialize

```solidity
function initialize(address owner, address _config) external
```

### migratePhase1

```solidity
function migratePhase1(contract GoldfinchConfig newConfig) external
```

### migrateCreditLines

```solidity
function migrateCreditLines(contract GoldfinchConfig newConfig, address[][] creditLinesToMigrate, uint256[][] migrationData) external
```

### bulkAddToGoList

```solidity
function bulkAddToGoList(contract GoldfinchConfig newConfig, address[] members) external
```

### pauseEverything

```solidity
function pauseEverything() internal
```

### migrateToNewConfig

```solidity
function migrateToNewConfig(contract GoldfinchConfig newConfig) internal
```

### upgradeImplementations

```solidity
function upgradeImplementations(contract GoldfinchConfig _config, address[] newDeployments) public
```

### migrateToSeniorPool

```solidity
function migrateToSeniorPool(contract GoldfinchConfig newConfig) internal
```

### closeOutMigration

```solidity
function closeOutMigration(contract GoldfinchConfig newConfig) external
```

