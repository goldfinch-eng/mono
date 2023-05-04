# Epochs.sol audit

Epochs.sol Audit.

This is a utility library for converting from timestamps to epochs and vice versa.
The length of an epoch is completely unchangeable.

# Summary

No issues found

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

## Isolated Analysis (only looking at the function impls)

- ❓ _toSeconds(uint256 epoch)_

  - ❓ General comments
    - ❓ I recommend renaming this to _startAt(uint256 epoch)_ I don't know what this function does from reading the name.
      Does it return the start of the epoch or the end of the epoch? I have to read the natspec to find out. This makes
      the reader's life unnecessarily difficult, especially when I'm not looking at the source, but at some other source
      that's calling it. The recommendation is also inline with the naming pattern of _currentEpochStartTimestamp()_. A
      better naming pair would be (_epochStartsAt_, _currentEpochStartsAt_)
  - ✅ How could it break?
    - ✅ Underflow when epoch \* (2 weeks) > type(uint256).max => epoch > type(uint256).max / (2 weeks).
      This would be an EXTREMELY LARGE epoch. Since epochs increment by 1 every week there's no chance
      enough time will elapse to reach an epoch so large it causes underflow here.

- _fromSeconds(uint256 s)_

  - How could it break?
    - ✅ Does it return the correct epoch when epoch_i-1.endsAt/epoch_i.startsAt < s < epoch_i.endsAt/epoch_i+1.startsAt?
      - ✅ In this range integer division will truncate the retval to epoch i, which is correct
    - ✅ Does it return the correct epoch when s = epoch_i.endsAt/epoch_i+1.startsAt
      - ✅ Recall that epoch_i.endsAt = (i+1) \* epoch_duration. Then s = i+1, which is correct, because the current time
        is epoch_i+1.startAt, and that means we're in epoch i+1

- ✅ _current()_

  - ✅ How could it break?
    - ✅ Looks solid to me. We've already analyzed _fromSeconds_ and that looked good. We're passing in `block.timestamp` here
      which is the correct timestamp to use for the current epoch

- ✅ _currentEpochStartTimestamp()_

  - ✅ How could it break?
    - ✅ Underflow caused by large parameter passed to _toSeconds()_
      - ✅ For their to be an underflow we would need `fromSeconds(block.timestamp) * epochSeconds > type(uint256).max` =>
        `block.timestamp / epochSeconds * epochSeconds > type(uint256).max` => `block.timestamp > type(uint256).max`,
        which is impossible.

- ✅ _next()_

  - ✅ How could it break?
    - ✅ I already audited _current()_ and am confident in its correctness. This one is just `current() + 1`, so it looks
      correct

- ❓ _secondsToNextEpoch()_
  - ❓ General comments
    - ❓ Could be simplified to `toSeconds(next()) - block.timestamp`. I recommended implementing this simplification.
  - ✅ How could it break?
    - ✅ We've already analyzed _next()_ and _toSeconds()_. This implementation looks good to me.

## Dependency Analysis (looking at the callers of the functions)

- ❓ _toSeconds(uint256 epoch)_ is called by...

  - ✅ _currentEpochStartTimestamp()_
    - ✅ Already audited, looks good
  - ✅ _secondsToNextEpoch()_
    - ✅ Already audited, looks good
  - ❓ It's not called outside anywhere else, i.e. not called the lib. Consider making it private

- ✅ _fromSeconds(uint256 s)_ is called by...

  - ✅ _current()_
    - ✅ Already audited, looks good
  - ✅ _currentEpochStartTimestamp()_
    - ✅ Already audited, looks good
  - ✅ _UserEpochTotals#recordDecrease(total, amount, depositTimestamp)_
    - ✅ What happens when a depoit and withraw happen in the same tx when block.timestamp % EPOCH_DURATION == 0?
      - ✅ `Epochs.fromSecond(depositTimestamp) == Epochs.current()` will evaluate to true and the correct clause
        of the if statement executes.
  - ✅ _MembershipVault#currentValueOwnedBy(owner)_
    - ✅ Here we pass `position.checkpointTimestamp` to _fromSeconds_. This is a unix timestamp, which is a valid use
      of _fromSeconds_.
  - ✅ _MembershipDirector#claimableRewards(owner)_
    - ✅ We pass `position.checkpointTimestamp` to _fromSeconds_. Since `position.checkpointTimestmap` is a unix timestamp
      this is a valid use of _fromSeconds_.

- ❓ _current()_ is called by...

  - ✅ _MembershipCollector_
    - ✅ _allocateToElapsedEpochs(fiduAmount)_
      - ✅ The line `uint256 currentEpoch = Epochs.current();` looks like valid use of _current()_.
  - ✅ _MembershipDirector_
    - ✅ _calculateRewards(startEpoch, amount, nextAmount)_
      - ✅ Use of _current()_ checks out but I have the same recommendation as D-Nice. It should never be the
        case that `context.membershipCollector().lastFinalizedEpoch() > Epochs.current()`, so the min can
        be removed and so can `Epochs.current()`.
  - ✅ _MembershipVault_
    - ✅ _initialize()_
      - ✅ Sets the last checkpointed epoch to be the current epoch. This looks good.
    - ✅ _currentValueOwnedBy(owner)_
      - ✅ It compares the current epoch against the position's last checkpointed epoch. Looks good
    - ✅ _currentTotal()_
      - ✅ Returns `totalAtEpoch(Epochs.current())`. This checks out
    - ❓ _totalAtEpoch(epoch)_
      - ❓ Compares input `epoch` against current
        - ✅ Reverts if it exceeds current.
        - ❓ Returns totalAmounts for checkpointed + 1 if it's less than current. I think we have multiple problems...
          - ❓ If n epochs have elapsed since the last checkpoint then we should return `totals[checkpointed + n]`.
          - ❓ `totals` is just a map. If we haven't checkpointed epoch with id `checkpointed + 1` yet then how could
            `totals[checkpointed + 1]` be initialized?
        - ✅ Returns `totals[checkpointed] ` if current equals checkpointed. This checks out
    - ✅ _increaseHoldings(owner, nextAmount)_
      - ✅ Emits `VaultToUpdate` event with `totalAmounts[Epochs.current()]` as the eligible amount. I think this checks out
    - ✅ _decreaseHoldings(owner, eligibleAmount, nextEpochAmount)_
      - ✅ Same as _increaseHoldings_, it looks good.
    - ✅ _\_checkpoint(owner)_
      - ✅ Sets `checkpointedEpoch = Epochs.current()`. This checks out.
      - ✅ Emits a Checkpoint event uusing the totals of the current epoch. This checks out.
  - ✅ _UserEpochTotals_
    - ✅ _\_checkpoint(total)_
      - ✅ Checks `Epochs.current()` against `total.checkpointedAt`. This checks out.
    - ✅ _getTotals(\_total)_
      - ✅ Checks `Epochs.current()` against `checkpointedAt`. This checks out.
    - ✅ _recordDecrease(total,amount,depositTimestamp)_
      - ✅ Already analyzed

- ✅ _currentEpochStartTimestamp()_ is called by...

  - ✅ _MembershipCollector_
    - ✅ _allocateToElapsedEpochs(fiduAmount)_
      - ✅ Computes time elapsed in the current epoch as `block.timestamp - Epochs.currentEpochStartTimestamp();`. This checks
        out.

- ✅ _next()_ is called by...

  - ✅ _MembershipVault_
    - ✅ _increaseHoldings(owner, nextAmount)_
      - ✅ Increases totals for _next()_ to be the delta of new next amount and old next amount. Since new next amount is always
        ✅ greater than old next amount, this checks out.
      - ✅ Emits VaultToUpdate with `nextEpochAmount` as totalAmounts for _next()_. This checks out.
    - ✅ _decreaseHoldings(owner, eligibleAmount, nextEpochAmount)_
      - ✅ Decreases totals for _next()_ to be the delta of the old next epoch amount and the new next epoch amount. Since the old
        next epoch total is always lower than the new next epoch total, it checks out.
      - ✅ Emits VaultToUpdate with `nextEpochAmount`as totalAmounts for _next()_. This checks out.

- ❓ _secondsToNextEpoch()_ is called by...
  - ❓ Not called anywhere. Consider deleting.

## Pre-audit checklist

### Legend

- ✅ Looks good
- 🚧 No action needed but good to be aware of
- 🛑 Action needed
- ⚪ Not applicable

- ✅ Testing and compilation

  - ✅ Has solid test coverage
    - All fns covered (except the one that's not called anywhere)
  - ⚪ Tests for event emissions
  - ⚪ Mainnet forking tests
  - ✅ Contract compiles without warnings
  - ⚪ Any public fns not called internal are external
    - This is a lib so all fns are internal

- ✅ Documentation

  - ✅ All fns documented with NatSpec

- ⚪ Access Control

  - ⚪ This is an internal lib so not applicable

- ⚪ For the auditors

- ⚪ Proxies

- ✅ Safe Operations

  - ⚪ Using SafeERC20 for ERC20 transfers
    - No ERC20 transfers present
  - ⚪ Using SafeMath lib
    - Not necessary in this solc version
  - ⚪ Using SafeCast
    - No casting present
  - ⚪ Unbounded arrays: no for loops or passing as params
    - No unbounded arrays in the logic
  - ✅ Division operations appear at the end
    - If we expand the computation for _currentEpochStartTimestamp_ we find that it actually does a
      division operation before a multiplcation operation
      ```
      currentEpochStartTimestamp()
      = toSeconds(current())
      = toSeconds(fromSeconds(block.timestamp))
      = toSeconds(block.timestamp / EPOCH_DURATION)
      = (block.timestamp / EPOCH_DURATION) * EPOCH_DURATION
      ```
      This result is different from `(block.timestamp * EPOCH_DURATION) / EPOCH_DURATION` when
      `block.timestamp` is not a multiple of `EPOCH_DURATION`. In this case the former behavior
      is current. E.g. if `0 <= block.timestamp < EPOCH_DURATION` then we're in the first epoch
      and it's start time should be 0. The former logic gives us the correct value but the latter
      will give us `block.timestamp`, which is incorrect.
  - ⚪ Not using built in _transfer_
  - ⚪ Untrusted input sanitization
    - No need to sanitize inputs
  - ⚪ State updates doen BEFORE calls to untrusted addresses
  - ⚪ Follows checks-effects-interactions pattern
    - All fns are pure
  - ⚪ Inputs to `external` and `public` fns are validated
  - ⚪ `SECONDS\_PER\_YEAR` leap year issues

- ⚪ Speed bumps, circuit breakers, and monitoring

- ⚪ Protocol integrations

## External view functions

### `fromSeconds`

Correct.

### `current`

Correct.

### `currentEpochStartTimestamp`

Correct.

### `previous`

Correct.

### `next`

Correct.

### `startOf`

Correct.
