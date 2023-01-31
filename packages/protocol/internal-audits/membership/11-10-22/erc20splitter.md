# ERC20Splitter

ERC20Splitter.sol Audit

# Summary

We have several low-severity findings.

- _distribute_ triggers _onReceive_ when `owedToPayee = 0`.

  - **Severity**: 🟢 Informational / Gas optimization
  - **Description**: By moving
    ```
    if (payee.isContract()) {
      triggerOnReceive(payee, owedToPayee);
    }
    ```
    Inside the if condition
    ```
    if (owedToPayee > 0) {
      erc20.transfer(payee, owedToPayee);
    }
    ```
    We can avoid the gas cost of calling out to the payee when the transfer is 0
  - **Suggested Fix**: Put _triggerOnReceive_ inside the if clause
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- Comment in _triggerOnReceive_ incorrectly states that a 0-length error reason implies payee does not implement IERC20SplitterReceiver

  - **Severity**: 🟢 Informational
  - **Description**: If a `require(cond)` (no error message) fails then the error message is 0-length. Therefore a payee
    could implement IERC20SplitterReceiver and still return a 0-length failure reason if a `require(cond)` is triggered in
    its implementation
  - **Suggested Fix**:
    - Fix 1: Keep same behavior but rewrite the comment for accuracy to something like "If the receiver does not implement the interface
      OR it it fails unexpectedly during onReceive then continue".
    - Fix 2: Unconditionally continue execution even if the call reverts.
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _replacePayees_ doesn't zero out values in `shares` map for old payees

  - **Severity**: 🟢 Informational
  - **Description**: `shares[payee]` persists even if `payee` is removed from the list of payees. Although this doesn't affect
    distributions because `payee` is no longer in the `payees` list, it's an inaccurate represenation of `payee`'s current share
    if someone were to query `shares` map for that payee.
  - **Suggested Fix**: Zero out the `shares` map for every payee in the old `payee` array
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _replacePayees_ allows `sum(shares) = 0`
  - **Severity**: 🟢 Informational
  - **Description**: When payees + shares are replaced, at least one of the payees should have a non-zero share. If no payees
    had a non-zero share then `totalShares` would be 0, and this would cause division-by-zero errors in _pendingDistributionFor_
    and _distribute_.
  - **Suggested Fix**: Add a `require(totalShares > 0)` at the end of the fn
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

- _distribute_

  - triggers _onReceive_ for 0 amounts. Slight optimization is to put the isContract check
    INSIDE the first if statement, because we don't have to trigger an on receive if no
    tokens were received
  - is it possible due to integer division rounding that totalToDistribute != sum[(totalToDistribute \* shares[i]) / totalShares]?
    - Yes, but since integer division rounds DOWN, if they are not equal then totalToDistribute > sum[(totalToDistribute \* shares[i]) / totalShares].
      We'll could have some dust leftover but the distribution will still succeed.

- _triggerOnReceive_

  - I'm not sure if not implementing IERC20SplitterReceiver is the ONLY reason the contract reverts
    with a zero-length reason
    > // A zero-length reason means the payee does not implement IERC20SplitterReceiver. In that case, just continue.
    > A contract could implement IERC20SplitterReceiver but if require without a message fails in the implementation
    > then the failure we have a 0 byte reason even when the receiver implements the interface
    - `assert(cond)` => more than 0 bytes
    - `require(cond)` => 0 bytes

- _replacePayees_
  - Allows for setting up payees with 0 total shares, leading to invalid state causing division by 0 errors on distribution.
    Low impact because onlyAdmin
  - Doesn't old shares in map. So queryting the shares map will return non-zero values for old payees

## Functions

### `constructor`

- doesn't need an initializer because all of the fields being initialized in the constructor are immutable

### `pendingDistributionFor`

Returns the amount that will be distributed to a given address if distribute were called

### `distribute`

- [x] Vulnerable to re-entrancy attacks?

  - No. 1) you cannot call distribute mutiliple times within the same TX.
    `lastDistributionAt` is used effectively as a non-reentrancy gaurd. 2) there
    is no internal accounting updating to keep track of. The entire balance of the
    splitter is paid out on every call of distribute. 3) `payees` are most likely
    trusted addresses, so even if it was vulnerable to reentrancy attacks it
    wouldn't matter.
  - If you were the first payee and you re-entered `distribute` you could have multiple calls to `usdc.safeTransfer` invoked where
    you would receive your share of the remaining balance. Example:
    Given these shares
    | Bob | Alice |
    |:-------|:-------|
    |1 (25%) | 3 (75%)|

    Imagine Bob is the first payee and has set his payee contract to call
    `distribute` onReceive. Currently there are 10 USDC in the splitter.

    `distribute()`
    -> balanceForBob = 0.25 _ 10 = 2.5
    -> `usdc.transferTo(balanceForBob, bob)`
    -> `bob.onReceive(balanceForBob)`
    -> `distribute()`
    -> balanceForBob = 7.5 _ 0.25 = 1.875
    -> `usdc.transferTo(balanceForBob, b)`
    -> `bob.onReceive(balanceForBob)`
    -> ...

    Bob would have more than the amount of usdc expected to be sent to him
    within the tx, but eventually the tx would revert because when the
    re-entrant loop eventually is terminated the contract will try to send the
    USDC that should have been sent to alice because the amount that is going to
    be distributed is saved _before_ calling the on receive hook.

    -> return from `bob.onReceive`
    -> balanceForAlice = 0.75 \* 10 = 7.5
    -> `usdc.safeTransfer(balanceForAlice, alice)`
    -> REVERT, not enough USDC balance

    This has the effect that a malicious payee could prevent the contract from distributing by causing the contract
    to revert over and over again, but this is true regardless because a payee can just revert `onReceive`

### `replacePayees`

- onlyAdmin

Replaces all of the payees and the amount that is distributed to them.

- Allows for shares to be `0` for a given caller
  - This will result in nothing being distributed to the caller though, so it
    doesn't effect correctness.
- Allows the zero address to be passed
  - This will result in the splitter reverting on calls to `distribute` because the zero address
    won't correctly handle `IERC20SplitterReceiver.onReceive`. No funds will be lost and an admin action
    will be needed to update the payee, but this is fine.
