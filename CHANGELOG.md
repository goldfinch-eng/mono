# Change Log

All notable changes to this project will be documented in this file.

## Protocol v3.0.0 - 2022-11-30

### Updated

- StakingRewards
  - StakingRewards event `AddToStake` is added to the `addToStake` function
  - Created basic svg art to show onchain StakingToken metadata

- SeniorPool: breaking changes to the way withdrawals work
  - Added public functions _requestWithdrawal_, _cancelWithdrawalRequest_, and _claimWithdrawalRequest_ to
    faciliate withdrawals through the new epoch system
  - Added _sharesOutstanding_ view function to query for the pool's outstanding liabilities
  - Public functions _withdraw_ and _withdrawInFidu_ cannot be called anymore.

- Fidu
  - Asset/Liability mismatch uses SeniorPool's _sharesOutstanding_ instead of FIDU's _totalSupply()_
    for liabilities. This is to acommodate FIDU in the SeniorPool that hasn't been burned yet but has
    but will be when the most recently ended Withdrawal Epoch is checkpointed

### Fixed

- Added the missing `setBaseURI` function for erc721 to StakingRewards

### Added

- Added WithdrawalRequestToken, an ERC721 to represent a withdrawal request position for senior pool
  withdrawals

### Removed

- StakingRewards
  - Public functions _unstakeAndWithdraw_, _unstakeAndWithdrawMultiple_, _unstakeAndWithdrawInFidu_,
    and _unstakeAndWithdrawMultipleInFidu_ have been removed. Events UnstakedAndWithdrew and
    UnstakedAndWithdrewMultiple will no longer be emitted.


### Notes

- Need to request that OpenSea to reindex StakingRewards contract after successful deploy

## Protocol v2.8.0 - 2022-10-??

### Updated

- TODO Membership Rewards

### Fixed

- TODO Membership Rewards

### Notes

- TODO Membership Rewards

## Protocol v2.7.4 - 2022-09-28

### Updated

- SeniorPool

### Fixed

- Fixed Accountant library for writedown bug

### Notes

- Writedowns are now done on PoolToken rather then pools

## Protocol v2.7.3 - 2022-08-17

### Updated

- StakingRewards updated

### Fixed

- Bug fix where unstakeAndWithdrawInFidu did not have a goList check

### Notes

- None

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
