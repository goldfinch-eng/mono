## ConfigOptions

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x19BfbF921d48279391c7445303D89Cb4a6066b71

A central place for enumerating the configurable options of our GoldfinchConfig contract

### Numbers

```solidity
enum Numbers {
  TransactionLimit,
  TotalFundsLimit,
  MaxUnderwriterLimit,
  ReserveDenominator,
  WithdrawFeeDenominator,
  LatenessGracePeriodInDays,
  LatenessMaxDays,
  DrawdownPeriodInSeconds,
  TransferRestrictionPeriodInDays,
  LeverageRatio,
  SeniorPoolWithdrawalCancelationFeeInBps
}
```

### Addresses

```solidity
enum Addresses {
  Pool,
  CreditLineImplementation,
  GoldfinchFactory,
  CreditDesk,
  Fidu,
  USDC,
  TreasuryReserve,
  ProtocolAdmin,
  OneInch,
  TrustedForwarder,
  CUSDCContract,
  GoldfinchConfig,
  PoolTokens,
  TranchedPoolImplementation,
  SeniorPool,
  SeniorPoolStrategy,
  MigratedTranchedPoolImplementation,
  BorrowerImplementation,
  GFI,
  Go,
  BackerRewards,
  StakingRewards,
  FiduUSDCCurveLP,
  TranchedPoolImplementationRepository,
  WithdrawalRequestToken,
  MonthlyScheduleRepo,
  CallableLoanImplementationRepository
}
```

