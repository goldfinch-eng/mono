export const FIDU_ADDRESS = "0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF"
export const SENIOR_POOL_ADDRESS = "0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822"
export const POOL_TOKENS_ADDRESS = "0x57686612C601Cb5213b01AA8e80AfEb24BBd01df"
export const GOLDFINCH_CONFIG_ADDRESS = "0x4eb844Ff521B4A964011ac8ecd42d500725C95CC"
export const V2_2_MIGRATION_TIME = "1643943600"

// This config represents the enum config on protocol/core/ConfigOptions.sol where order is fixed
// (search for `library ConfigOptions` and `CONFIG_KEYS_BY_TYPE`)
export enum CONFIG_KEYS_NUMBERS {
  TransactionLimit = 0,
  TotalFundsLimit = 1,
  MaxUnderwriterLimit = 2,
  ReserveDenominator = 3,
  WithdrawFeeDenominator = 4,
  LatenessGracePeriodInDays = 5,
  LatenessMaxDays = 6,
  DrawdownPeriodInSeconds = 7,
  TransferRestrictionPeriodInDays = 8,
  LeverageRatio = 9
}
export enum CONFIG_KEYS_ADDRESSES {
  Pool = 0,
  CreditLineImplementation = 1,
  GoldfinchFactory = 2,
  CreditDesk = 3,
  Fidu = 4,
  USDC = 5,
  TreasuryReserve = 6,
  ProtocolAdmin = 7,
  OneInch = 8,
  TrustedForwarder = 9,
  CUSDCContract = 10,
  GoldfinchConfig = 11,
  PoolTokens = 12,
  TranchedPoolImplementation = 13,
  SeniorPool = 14,
  SeniorPoolStrategy = 15,
  MigratedTranchedPoolImplementation = 16,
  BorrowerImplementation = 17,
  GFI = 18,
  Go = 19,
  BackerRewards = 20,
  StakingRewards = 21
}

