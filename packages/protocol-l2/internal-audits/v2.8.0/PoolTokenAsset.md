# PoolTokenAsset

Library for checking pool token validity and for assessing value

# Summary

- _getUsdcEquivalent_ doesn't take into account capital at risk
  - **Severity**: 🟡 Medium
  - **Description**: Does not take into account the amount of "capital at risk, or, the amount of
    capital that a given address has access to if they were to call withdraw on the
    relevant pool. This means that every depositor of pool tokens can make a
    choice: is the added apy boost from not withdrawing the capital from their
    pool token more valuable than what they could otherwise do with the capital?
    As I see it, there is no reason that one wouldn't take their idle capital and
    place it into the senior pool or other sources of yield as the apy boost from
    membership is unlikely to be greater than those yields.
  - **Suggested Fix**: N/A
  - **Commit**: Latest

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference.

## External View Functions

### `isType`

Good

### `isValid`

Good

### `getUsdcEquivalent`

- ℹ️ Does not take into account the amount of "capital at risk, or, the amount of
  capital that a given address has access to if they were to call withdraw on the
  relevant pool. This means that every depositor of pool tokens can make a
  choice: is the added apy boost from not withdrawing the capital from their
  pool token more valuable than what they could otherwise do with the capital?
  As I see it, there is no reason that one wouldn't take their idle capital and
  place it into the senior pool or other sources of yield as the apy boost from
  membership is unlikely to be greater than those yields.
