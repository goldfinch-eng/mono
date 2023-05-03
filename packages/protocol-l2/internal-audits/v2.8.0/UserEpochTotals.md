# UserEpochTotals Audit

Auditor: [Dalton](https://github.com/daltyboy11)

UserEpochTotals.sol audit.

# Summary

We have a couple of nits but they're by no means launch blockers.

- _getTotals_ argument could be `memory` instead of `storage`.

  - **Severity**: 🟢 Informational
  - **Description**: _getTotals_ doesn't modify any `storage` so the storage param could be a `memory` param.
    This might be worse OR better but it depends on if we call in to the lib using a storage or memory struct.
    If we mostly use storage structs then there's gas overhead in copying the struct to memory when invoking the lib
  - **Suggested Fix**: No action necessary
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _recordDecrease_ is not defensive about checking for valid input
  - **Severity**: 🟢 Informational
  - **Description**: There are several assumptions _recordDecrease_ makes about its input without explicitly checking
    - `total.checkpointedAt <= Epochs.current()`
    - `Epochs.fromSeconds(depositTimestamp) <= Epochs.current()`
    - `Epochs.fromSeconds(depositTimestamp) <= total.checkpointedAt`
    - `amount <= total.totalAmount`
  - **Suggested Fix**: No action necessary. I only wanted to call it out.
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## Legend

- ✅ Looks good
  - reasonably confident in the security
- ❓ Questionable
  - An non-security issue, an issue where it's unclear if it's security related, or a security
    related issue that isn't a launch blocker.
- 🛑 Security vulnerability
  - A security bug that must be fixed before launch

## Function-by-function analysis

- ✅ _recordIncrease(total, amount)_

  - How could it break?
    - ✅ Forgets to checkpoint first
      - It checkpoints
    - ✅ Changes total `totalAmount` by wrong amount
      - It increases `totalAmount` by exactly `amount`
    - ✅ Changes `eligibleAmount` - it should never do this because none of the deposit is eligible during
      the epoch in which the deposit occurs
      - It doesn't

- ✅ _recordDecrease(total, amount, depositTimestamp)_

  - General comments
    - If we invert the if condition then we can pull `totalAmount -= amount` out
      ```
      total.totalAmount -= amount
      if (Epochs.current() > Epochs.fromSeconds(depositTimestamp)) {
        total.eligibleAmount -= amount
      }
      ```
  - How could it break?
    - ✅ Forgets to checkpoint first
      - It checkpoints
    - Changes `totalAmount` by wrong amount
      - ✅ It should decrease `totalAmount` by `amount` unconditionally
        - ✅ It decreases `totalAmount` by `amount` if the deposited epoch is in the past, which is correct
        - ✅ It decreases `totalAmount` by `amount` if the deposited epoch is current, which is correct
      - ✅ It should decrease eligible amount if deposit epoch is in the past
        - It does
      - ✅ It should leave eligible amount unchanged if deposit epoch is in the past
    - ❓ Invalid Inputs
      - ❓ The function's behavior relies on trusted input that doesn't fall into the following situations
        - `total.checkpointedAt <= Epochs.current()`
        - `Epochs.fromSeconds(depositTimestamp) <= Epochs.current()`
        - `Epochs.fromSeconds(depositTimestamp) <= total.checkpointedAt`
        - `amount <= total.totalAmount`

- ❓ _getTotals(\_total)_

  - ❓ Can be made `memory` instead of `storage`. Would avoid having to explicitly copy it into memory in
    the function body

- ✅ _\_checkpoint(total)_
  - ✅ How could it break?
    - ✅ Doesn't checkpoint when `checkpointedAt` is stale
      - It checkpoints
    - ✅ Doesn't update `checkpointedAt` when it's stale
      - It does update
    - ✅ Doesn't make totalAmount eligible when `checkpointedAt` is stale
      - It does
    - 🛑 Invalid input where `checkpointedAt > Epochs.current()`
      - We should change the check to
        ```
        if (total.checkpointedAt >= Epochs.current()) return;
        ```
        Because if the caller could manipulate the input to have `checkpointedAt` > Epochs.current()
        then the eligibleAmount would be to totalAmount too early.

## Dependency Analysis

Quick checks to see if the callers of the fn's are using the fn's in a way that makes sense.
Ways that don't make sense could be misinterpreting the return values or passing incorrect vals
as parameters.

- ✅ _recordIncrease(total, amount)_ is called by...

  - ✅ _CapitalLedger_
    - ✅ _depositERC721(owner, assetAddress, id)_
      - ✅ Records an increase in `owner`'s total of `usdcEquivalent`. Checks out
  - ✅ _GFILedger_
    - ✅ _deposit(owner, amount)_
      - ✅ Already audited. Looks good

- ✅ _recordDecrease(total, amount, depositTimestamp)_ is called by...

  - ✅ _CapitalLedger_
    - ✅ _withdraw(id)_
      - ✅ Records decrease by `usdcEquivalent` of the asset type being withdrawn. Checks out
  - ✅ _GFILedger_
    - ✅ _withdraw(id, amount)_
      - ✅ Records decrease by `amount`. Checks out.
    - ✅ _\_withdraw(id)_
      - ✅ Records decrease by full position amount. Checks out.

- ✅ _getTotals(\_total)_ is called by...

  - ✅ _CapitalLedger_
    - ✅ _totalsOf(addr)_
      - ✅ Return type is `(eligibleAmount, totalAmount)` and it returns `totals[addr].getTotals()`, whose return type
        is `(current, next)`. `current` maps to `eligible` and `next` maps to `total` so this checks out.
    - ✅ _GFILedger_
      - ✅ _totalsOf(addr)_
        - ✅ Same as _CapitalLedger_

- ✅ _\_checkpoint(total)_ is called by...
  - ✅ Checkpoint is an internal function so it's callers have already been analyzed in the isolated analysis

### Pre-audit Checlist

#### Legend

- ✅ Looks good
- 🚧 No action needed but good to be aware of
- 🛑 Action needed
- ⚪ Not applicable

- ✅ Testing and compilation

  - ✅ Changes have solid branch and line coverage
    - Couldn't generate coverage report for this because forge doesn't support coverage for libs atm:
      https://github.com/foundry-rs/foundry/issues/2567 but all fns are covered indirectly in the GFILedger
      and CapitalLedger tests
  - ⚪ Tests for event emissions
    - No event emissions in lib
  - ⚪ Mainnet forking tests
  - ✅ Contract compiles without warnings
  - ⚪ Any public fns that could be external are external

- ✅ Documentation

  - ✅ Fns are documented with NatSpec
  - ⚪ If the behavior of existing `external` and `public` functions was changed then their NatSpec was updated

- ⚪ Access Control

  - N/A for libs

- ⚪ For the auditors

  - N/A for libs

- ⚪ Proxies

  - N/A for libs

- ✅ Safe Operations

  - ⚪ SafeERC20
  - ⚪ SafeMath
  - ⚪ SafeCast
  - ⚪ Unbounded Arrays
  - ⚪ Division Operations
  - ⚪ Input sanitization
  - ✅ Checks effects interactions

- ⚪ Speed bumps, circuit breakers, and monitoring

- ⚪ Protocol integrations

## `UserEpochTotal`

a struct that wraps logic for checkpoint how much a user has of something in
that's elligible in a given epoch. When a user first deposits the amount will be
count towards the total amount, but not the "elligible" amount. When an epoch is
crossed over the total amount becomes the ellible amount.

### `recordIncrease`

- [x] checkpoints

* Increases the amount and checkpoints if we crossed an epoch

### `recordDecrease`

- [x] checkpoints
      Looks good

### `getTotals`

- [x] checkpoints

* Returns the totals
