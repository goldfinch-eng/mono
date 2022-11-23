# Capital Ledger Audit
Auditor: [Dalton](https://github.com/daltyboy11)

CapitalLedger.sol audit

# Summary

I found one medium/low issue around token indices. It's not critical because the issue is in a view fn
and it's not used within non-view fn contract logic, but it should still be fixed before going to production.

* _tokenByIndex_ off-by-one error
  * **Severity**:  🟡 Medium
  * **Description**: The first valid position id is 1. The token at position 0 should be 1 and the token at position i should be i + 1.
  * **Suggested Fix**: We should return `index + 1` instead of `index`
  * **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)