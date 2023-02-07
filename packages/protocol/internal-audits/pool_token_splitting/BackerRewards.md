# Backer Rewards Audit

BackerRewards.sol audit

# Summary

**Commit**: [946b69c](https://github.com/warbler-labs/mono/pull/1363/commits/946b69c6296f80c02202a58b341ca7e193ce0401)

Review partial changes to BackerRewards for the Pool Token Splitting feature. The changes modify how pool tokens are minted and adds the ability to split them in two. All functions are pure additions and no existing functions were changed.

There were no issues found in Backer Rewards.

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference.

## External Functions

### `setBackerAndStakingRewardsTokenInfoOnSplit`

- onlyPoolTokens - read from goldfinch config

### `clearTokenInfo`

- onlyPoolTokens - read from goldfinch config

#### External Calls

None

## External View Functions

### `getBackerRewardsTokenInfo`

- View to read tokens

### `getBackerStakingRewardsTokenInfo`

- View to read tokenStakingRewards

### `getBackerStakingRewardsPoolInfo`

- View to read poolStakingRewards
