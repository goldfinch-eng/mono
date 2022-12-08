# Verify epochs are checkpointed for every checkpoint worthy action

Auditor: [Dalton](https://github.com/daltyboy11)

A checkpoint worthy action on the SeniorPool is a call to an external/public fn that
meets one or more of the following conditions:

1. USDC inflows
2. USDC outflows
3. FIDU inflows
4. FIDU minted
5. FIDU burned
6. Share price changes
7. Changes the epoch duration

As part of this audit we identified these fn's and verified that we didn't forget to checkpoint
in any of them:

- deposit (1)
- redeem (1, 6)
- invest (2)
- withdraw (2, 5)
- withdrawInFidu (2, 5)
- requestWithdrawal (3)
- addToWithdrawalRequest (3)
- claimWithdrawalRequest (2)
- writedown (6)

The conclusion is that in every place withdrawal mechanics _should_ be checkpointed, withdrawal
mechanics _is_ checkpointed.
