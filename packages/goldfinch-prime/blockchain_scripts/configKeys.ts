const CONFIG_KEYS_BY_TYPE = {
  numbers: {
    ReserveDenominator: 0,
    LatenessGracePeriodInDays: 1,
    DrawdownPeriodInSeconds: 2,
  },
  addresses: {
    GoldfinchFactory: 0,
    USDC: 1,
    TreasuryReserve: 2,
    ProtocolAdmin: 3,
    GoldfinchConfig: 4,
    PoolTokens: 5,
    Go: 6,
    MonthlyScheduleRepo: 7,
    CreditLineBeacon: 8,
    TranchedPoolBeacon: 9,
    CallableLoanBeacon: 10,
    GPrime: 11,
  },
}

const CONFIG_KEYS = {...CONFIG_KEYS_BY_TYPE.numbers, ...CONFIG_KEYS_BY_TYPE.addresses}

export {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE}
