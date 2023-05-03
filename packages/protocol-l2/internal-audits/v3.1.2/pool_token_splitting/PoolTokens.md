# Pool Tokens Audit

PoolTokens.sol audit

# Summary

**Commit**: [946b69c](https://github.com/warbler-labs/mono/pull/1363/commits/946b69c6296f80c02202a58b341ca7e193ce0401)

Reviewing partial changes to PoolTokens for the Pool Token Splitting feature. The changes modify how pool tokens are minted and adds the ability to split them in two.

- **Severity**: 🟢 Informational
- **Description**: Although this is not a current attack vector, if \_mint were to change to \_safeMint attackers could manipulate the value of their split tokens for monetary gain, changing the value of their original token in the middle of minting. Reentrancy protection may not be enough here as some other contracts keep state related to the pool tokens. See Appendix for more information.
- **Suggested Fix**: Follow checks/effects/interactions or verify state at the end of splitting.

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference.

## External Functions

### `mint`

- onlyPool
- whenNotPaused
- [x] Check reentrancy. Safe but recommend nonReentrancy modifier

  `setPoolTokenAccRewardsPerPrincipalDollarAtMint` is called after the minting of the token. This transfers a token from the contract to an externally supplied address, we'll call this Addr. If Addr is a smart contract, it could get a callback on this transfer, if we use \_safeMint. In this case, we do not use \_safeMint and use \_mint instead. Also, the only caller of \_mint uses the nonReentrancy modifier.

  Were we using \_safeMint and missing the nonReentrancy modifier, Addr could potentially manipulate `accRewardsPerPrincipalDollarAtMint` on the token by minting and updating `pool.accRewardsPerPrincipalDollar` on the callback. They could even recurse at this point, creating many tokens with artificially inflated `accRewardsPerPrincipalDollarAtMint`. This would also affect all tokens created after such an "attack".

  This is safe, but fairly deep in the stack and seems like it could be accidentally exposed in the future. Recommend reviewing this and considering adding more protections to PoolTokens/BackerRewards. Ideally this follows checks/effects/interactions, but the construction of BackerRewards may make this impossible.

### `burn`

- only approved or owner or pool
- whenNotPaused
- no potential issues found

### `splitToken`

- only approved or owner
- new principal must be non-zero and less than token amount
- [x] Reentrancy. Safe, but recommended reviewing security. If possible, burn tokens to start following checks/effects/interactions.

If \_mint were changed to \_safeMint in the future, attacker could:

1. Have token T, assume T has some available interest I and principal P
2. Split T into A, B
3. On creation of A (or B), redeem I and P
4. Allow split to continue
5. Result: T burnt, A,B with split share of _original I and P_, Addr with extra I and P. Addr can then withdraw I and P again from split tokens.

- [x] Split before pool closes. Safe, possibly recommend not allowing to reduce surface area and users who want to split can withdraw some and create a new pool token anyway.

#### External Calls

- [`backerRewards.clearTokenInfo`](./BackerRewards.md) **contract**
- [`backerRewards.setBackerAndStakingRewardsTokenInfoOnSplit`](./BackerRewards.md) **contract**
- [`backerRewards.getBackerRewardsTokenInfo`](./BackerRewards.md) **contract**

## External View Functions

### `getPoolInfo`

Returns state of pool token.
