# ERC20Splitter
Auditor: [Dalton](https://github.com/daltyboy11)

ERC20Splitter.sol Audit

# Summary

I have several low-severity and informational findings.

* _distribute_ triggers _onReceive_ when `owedToPayee = 0`.
  * **Severity**: 🟢 Informational / Gas optimization
  * **Description**: By moving
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
  * **Suggested Fix**: Put _triggerOnReceive_ inside the if clause
  * **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

* Comment in _triggerOnReceive_ incorrectly states that a 0-length error reason implies payee does not implement IERC20SplitterReceiver
  * **Severity**: 🟢 Informational
  * **Description**: If a `require(cond)` (no error message) fails then the error message is 0-length. Therefore a payee
  could implement IERC20SplitterReceiver and still return a 0-length failure reason if a `require(cond)` is triggered in
  its implementation
  * **Suggested Fix**:
    * Fix 1: Keep same behavior but rewrite the comment for accuracy to something like "If the receiver does not implement the interface
    OR it it fails unexpectedly during onReceive then continue".
    * Fix 2: Unconditionally continue execution even if the call reverts.
  * **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

* _replacePayees_ doesn't zero out values in `shares` map for old payees
  * **Severity**: 🟢 Informational
  * **Description**: `shares[payee]` persists even if `payee` is removed from the list of payees. Although this doesn't affect
  distributions because `payee` is no longer in the `payees` list, it's an inaccurate represenation of `payee`'s current share
  if someone were to query `shares` map for that payee.
  * **Suggested Fix**: Zero out the `shares` map for every payee in the old `payee` array
  * **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

* _replacePayees_ allows `sum(shares) = 0`
  * **Severity**: 🟢 Informational
  * **Description**: When payees + shares are replaced, at least one of the payees should have a non-zero share. If no payees
  had a non-zero share then `totalShares` would be 0, and this would cause division-by-zero errors in _pendingDistributionFor_
  and _distribute_.
  * **Suggested Fix**: Add a `require(totalShares > 0)` at the end of the fn
  * **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

# Appendix
Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

- _distribute_
  - triggers _onReceive_ for 0 amounts. Slight optimization is to put the isContract check
    INSIDE the first if statement, because we don't have to trigger an on receive if no
    tokens were received
  - is it possible due to integer division rounding that totalToDistribute != sum[(totalToDistribute * shares[i]) / totalShares]?
    - Yes, but since integer division rounds DOWN, if they are not equal then totalToDistribute > sum[(totalToDistribute * shares[i]) / totalShares].
      We'll could have some dust leftover but the distribution will still succeed.

- _triggerOnReceive_
  - I'm not sure if not implementing IERC20SplitterReceiver is the ONLY reason the contract reverts
    with a zero-length reason
    > // A zero-length reason means the payee does not implement IERC20SplitterReceiver. In that case, just continue.
    A contract could implement IERC20SplitterReceiver but if require without a message fails in the implementation
    then the failure we have a 0 byte reason even when the receiver implements the interface
      * `assert(cond)` => more than 0 bytes
      * `require(cond)` => 0 bytes

- _replacePayees_
  - Allows for setting up payees with 0 total shares, leading to invalid state causing division by 0 errors on distribution.
    Low impact because onlyAdmin
  - Doesn't old shares in map. So queryting the shares map will return non-zero values for old payees