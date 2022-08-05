# Change Log

All notable changes to this project will be documented in this file.

## Protocol v2.7.1 - 2022-07-20

### Updated

- [GIP-10](https://gov.goldfinch.finance/t/gip-10-remove-12-month-vesting-requirement-for-senior-pool-liquidity-mining/912#summary-1)
  Removed vesting for new StakingRewards positions. Also removed slashing for all positions.
- Added batch versions of Zapper functions

### Fixed

- Use the FIDU/Curve LP token ratio in the Curve pool to calculate exchange rate.

### Notes

- Cleaned up legacy contracts
- TranchedPool changes are merged but will go out in a future deploy
