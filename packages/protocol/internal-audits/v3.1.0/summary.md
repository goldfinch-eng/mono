![Warbler-Logo](../warbler-logo.png)

# Audit Summary
In this audit we focused on `Go.sol` and its dependencies. The change was to allow calls where tx.origin holds a
UID but msg.sender doesn't, opening up the protocol to re-entrancy or chains of calls in a single tx. Therefore,
re-entrancy was a focus area.

## Issue Count
Two low impact issues were found, both unrelated to the Go changes.

| **Contract**     | 🛑 | 🟡 | 🟢 | **Total** |
|------------------|---|---|---|-----------|
| **All**          | 0 | 0 | 2 | 2         |
| TranchedPool.sol | 0 | 0 | 2 | 2         |