const CONFIG_KEYS_BY_TYPE = {
  numbers: {
    TransactionLimit: 0,
    TotalFundsLimit: 1,
    MaxUnderwriterLimit: 2,
    ReserveDenominator: 3,
    WithdrawFeeDenominator: 4,
    LatenessGracePeriodInDays: 5,
    LatenessMaxDays: 6,
    DrawdownPeriodInSeconds: 7,
    TransferPeriodRestrictionInDays: 8,
    LeverageRatio: 9,
    SeniorPoolWithdrawalCancelationFeeInBps: 10,
  },
  addresses: {
    Pool: 0,
    CreditLineImplementation: 1,
    GoldfinchFactory: 2,
    CreditDesk: 3,
    Fidu: 4,
    USDC: 5,
    TreasuryReserve: 6,
    ProtocolAdmin: 7,
    OneInch: 8,
    // TrustedForwarder is deprecated because we no longer use GSN
    TrustedForwarder: 9,
    CUSDCContract: 10,
    GoldfinchConfig: 11,
    PoolTokens: 12,
    TranchedPoolImplementation: 13,
    SeniorPool: 14,
    SeniorPoolStrategy: 15,
    MigratedTranchedPoolImplementation: 16,
    BorrowerImplementation: 17,
    GFI: 18,
    Go: 19,
    BackerRewards: 20,
    StakingRewards: 21,
    FiduUSDCCurveLP: 22,
    TranchedPoolImplementationRepository: 23,
    WithdrawalRequestToken: 24,
    MonthlyScheduleRepo: 25,
  },
}

const CONFIG_KEYS = {...CONFIG_KEYS_BY_TYPE.numbers, ...CONFIG_KEYS_BY_TYPE.addresses}

export {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE}
