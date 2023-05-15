![Warbler-Logo](../warbler-logo.png)

# Audit Summary

Auditors: [Dalton](https://github.com/daltyboy11), [Will](https://github.com/wbj-goldfinch), [Sanjay](https://github.com/sanjayprabhu)

We broke the system down into two parts to audit separately: epoch-level mechanics and request-level mechanics.
Dalton audited epoch-level mechanics and Will audited request-level mechanics. Sanjay did a system-wide audit.

## Issue Count

| **Contract**   | 🛑  | 🟡  | 🟢  | **Total** |
| -------------- | --- | --- | --- | --------- |
| **All**        | 0   | 1   | 3   | 4         |
| SeniorPool.sol | 0   | 1   | 3   | 4         |

## Epoch-level mechanics summary

We attacked the code from several angles.

- Identified as many invariants as we could and analyzed them to determine how the could be violated.
  We couldn't find any invariant violations (see `invariant-analysis.md`). Future work will be to plug the
  invariants into an analysis tool like Echidna.
- Checked that every code path that _should_ trigger epoch checkpointing _does_ in fact trigger epoch
  checkpointing (see `verify-no-missed-checkpointing.md`).
- Went through the pre-audit and audit checklists (see `pre-audit-checklist.md`).
- Analyzed integer rounding in the epoch liquidation math and concluded that epoch variables like `usdcAllocated`, `fiduLiquidated`, etc. aren't adversely affected
  (see`rounding-errors-from-integerd-division.md`).
- Thought through what would happen if ERC20's were sent directly to the senior pool
  (see `sending-erc20s-directly-to-pool.md`).

## Request-level mechanics summary

TODO(Will)
