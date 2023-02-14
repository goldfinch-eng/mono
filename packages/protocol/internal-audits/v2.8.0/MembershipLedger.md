# MembershipLedger

MembershipLedger.sol audit

# Summary

I analyzed what a rational actor might do if they have an membership position and can frontrun a _setAlpha_
txn. There are scenarios where frontrunning _setAlpha_ is advantangeous to the membership participant but
they don't appear to be harmful to the protocol.

- _setAlpha_ frontrunning opportunity to maximize membership score

  - **Severity**: 🟢 Informational
  - **Description**: If I have vault holdings accruing rewards for one or more epochs for which my position hasn't
    been checkpointed, and I see a _setAlpha()_ tx in the mem pool such that checkpointing my rewards with the old
    `alpha` will give me a higher `position.nextEpochAmount` (this calc happens in _increaseHoldings_) than
    checkpointing with the new `alpha`, then it is rationale for me to frontrun the _setAlpha_ tx to secure the higher
    reward amount.

    As an example, suppose I have 100 GFI and 25 Capital and alpha = 0.5. Then my score is gfi^𝝰 \* capital^(1-𝝰)
    = sqrt(100) + sqrt(25) = 15. If _setAlpha(0.4)_ is submitted to the mem pool, then after the tx is executed
    my new score would be 100^0.4 + 25^0.6 = 13.2. If I haven't checkpointed in this epoch yet then I can trigger
    a checkpoint to secure my score `positions[tokenId].nextEpochAmount = nextAmount = 15`. If I've already
    checkpointed in this epoch then my nextEpochAmoutn is already 15 and I don't have to do anything. As long as
    I wait until the next epoch to trigger another checkpoint I can secure
    `positions[positionId].eligibleAmount = previousPosition.nextEpochAmount = 15;`. But if I interact with
    the vault before the epoch ends then I'll trigger a checkpoint and reset nextEpochAmount `positions[tokenId].nextEpochAmount = nextAmount = 13.2`.

  - **Suggested Fix**: Checkpoint the epochs when alpha is set and make the alpha not take effect until the start
    of the next epoch
  - **Commit**: [9608103](https://github.com/warbler-labs/mono/pull/1069/commits/96081036fe09fb62556741a9853a299219ed7fb5)

- `totalAmounts` checkpointing in MembershipVault doesn't account for changes to `alpha`

  - **Severity**: 🟢 Informational
  - **Description**: Updating `alpha` breaks an assumption in membership vault checkpointing: setting the total
    amount for every epoch to `totalAmounts[checkpointEpoch + 1]` in this for loop assumes that
    `alpha` hasn't changed in any of the epochs between checkpointedEpoch + 1 and currentEpoch + 1. In the
    extreme case we could have changed `alpha` in every one of those epochs and `totalAmounts[epoch]` wouldn't
    reflect the score for what `alpha` actually was in that epoch, but instead it would reflect the score for
    the current `alpha`.

    ```
    uint256 lastCheckpointNextAmount = totalAmounts[checkpointEpoch + 1];
    for (uint256 epoch = checkpointEpoch + 1; epoch <= currentEpoch + 1; epoch++) {
      totalAmounts[epoch] = lastCheckpointNextAmount;
    }
    ```

  - **Suggested Fix**: Checkpoint `totalAmounts` when `alpha` is set.
  - **Commit**: [9608103](https://github.com/warbler-labs/mono/pull/1069/commits/96081036fe09fb62556741a9853a299219ed7fb5)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## External Functions

### `initialize`

- [x] uses `initializer` modifier
- [x] calls dependency intializers

### `resetRewards`

- [x] onlyOperator
      Resets allocated rewards

### `allocateRewardsTo`

- [x] onlyOperator

### `setAlpha`

- [x] onlyAdmin
- [x] validates input

## External View functions

### `getPendingRewardsFor`

simple view function
