## MigratedTranchedPool

### migrated

```solidity
bool migrated
```

### migrateCreditLineToV2

```solidity
function migrateCreditLineToV2(contract IV1CreditLine clToMigrate, uint256 termEndTime, uint256 nextDueTime, uint256 interestAccruedAsOf, uint256 lastFullPaymentTime, uint256 totalInterestPaid) external returns (contract IV2CreditLine)
```

### migrateDeposits

```solidity
function migrateDeposits(contract IV1CreditLine clToMigrate, uint256 totalInterestPaid) internal
```

