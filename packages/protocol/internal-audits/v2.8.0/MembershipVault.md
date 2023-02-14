# MembershipVault

MembershipVault.sol audit

# Summary

I found some medium-severity issues that should be fixed before going to production.

- _increaseHoldings_ can potentially revert with `NewValueMustBeGreater` if `alpha` changes. This
  would block deposits for the user

  - **Severity**: 🟡 Medimum
  - **Description**: A user's total can decrease when `alpha` changes even if their total deposits increase. Example
    1. (100 GFI, 110 Capital, alpha 0.5) => 104.8 score
    2. increase capital by 1 and change alpha to 0.8
    3. (100 GFI, 111 Capital, alpha 0.8) => 102.1 score
       In this scenario _increaseHoldings_ reverts with `NewValueMustBeGreater` but this should be considered a valid scenario.
  - **Suggested Fix**: Remove the check for `NewValueMustBeGreater` and modify the `totalAmounts` calculation to avoid
    overflows
    ```
    // Old way
    totalAmounts[Epochs.next()] += nextAmount - previousNextEpochAmount;
    // New way
    totalAmounts[Epochs.next()] = totalAmounts[Epochs.next()] + nextAmount - previousNextEpochAmount;
    ```
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _decreaseHoldings_ can potentially revert with `NewValueMustBeLess` if `alpha` changes. This would block withdrawals for the user

  - **Severity**: 🟡 Medimum
  - **Description**: A users's total score can increase when `alpha` changes even if their total deposits decrease.
  - **Suggested Fix**: Remove the check for `NewValueMustBeLess` and modify the `totalAmounts` calculation to avoid overflows.
    ```
    // Old way
    totalAmounts[Epochs.current()] -= position.eligibleAmount - eligibleAmount;
    totalAmounts[Epochs.next()] -= position.nextEpochAmount - nextEpochAmount;
    // New way
    totalAmounts[Epochs.current()] = totalAmounts[Epochs.current] + position.eligibleAmount - eligibleAmount;
    totalAmounts[Epochs.next()] = totalAmounts[Epochs.next()] + position.nextEpochAmount - nextEpochAmount;
    ```
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _tokenByIndex_ off-by-one error

  - **Severity**: 🟡 Medium
  - **Description**: The first valid position id is 1. So the token at position 0 should be 1 and the token at position i should be i + 1.
  - **Suggested Fix**: We should return `index + 1` instead of `index`
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _tokenByIndex_ does not revert for invalid index

  - **Severity**: 🟢 Informational
  - **Description**: `if (index > totalSupply()) revert IndexGreaterThanTokenSupply();` will not revert if you pass an index equal to total supply,
    but this should be considered an invalid index. E.g. if total supply is 1 and I query _tokenByIndex(1)_ then it should revert but the
    current impl does not.
  - **Suggested Fix**: Check `index >= totalSupply()` instead of a strict gt comparison
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- _positionOwnedBy_ doesn't account for finalized epochs
  - **Severity**: 🟢 Informational
  - **Description**: The storage value `positions[owners[owner]]` is stale if an epoch is over but unfinalized. E.g. If I deposit in this epoch
    I will have a non-zero `nextEpochAmount` and zero `eligibleAmount`. After this epoch ends and BEFORE I have checkpointed my position, then when I
    call _positionOwnedBy_ it will return the same non-zero and zero amounts respectively, but my `eligibleAmount` should be non-zero.
  - **Suggested Fix**: Update the logic to "preview" or "simulate" the checkpoint so we can return the up-to-date position
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

## Analysis

- _increaseHoldings(address owner, uint256 nextAmount)_

  - How could it break?

    - 🛑 nextAmount < previousEpochNextAmount can fail when we change alpha If alpha is changed then it's
      possible that on my next deposit my score will decrease despite an increase my total holdings.
      Consequently, this prevent me from making any further deposits until alpha is changed again.
      This should be considered a valid scenario and we should remove the check.

      Futhermore, nextAmount - previousNextEpochAmount will revert due to overflow. We should use a
      saturating sub instead.

- _decreaseHoldings(owner, eligibleAmount, nextEpochAmount)_

  - 🛑 How could it break?

    - 🛑 nextEpochAmount > position.nextEpochAmount or eligibleAmount > position.eligibleAmount could
      fail when we update alpha. Depending on the user's ratio of GFI to Capital, the new alpha could
      increase their score even accounting for the holding decrease. This should be considered a
      valid scenario and we should remove the check.

      Furthermore, position.eligibleAmount - eligibleAmount and position.nextEpochAmount - nextEpochAmount
      can revert due to overflow. We should use a saturating sub instead.

- 🛑 _tokenByIndex(uint256 index)_

  - How could it break?
    - 🛑 Off by one error
      - Should return `index + 1` instead of `index`
      - Check should be `if (index >= totalSupply()) revert IndexGreaterThanTokenSupply();`

- ❓ _positionOwnedBy(address owner)_
  - ❓ We should either account for non-finalized epochs for the position or conspicuously call
    out in the interface that it does not account for non-finalized epochs.

## Functions

### `adjustHoldings`

- Only callable by the membership director

Set the amount eligible for the current epoch as well as the amount eligible for the next epoch

### `_checkpoint`

- carries forward the total balances into future epochs from the
  epoch following the last checkpointed epoch
- promotes a users nextBalance to their elligible balance and updates the last
  epoch checkpointed cursor
