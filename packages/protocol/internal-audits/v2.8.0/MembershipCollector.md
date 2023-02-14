# MembershipCollector

MembershipCollector.sol audit. Handles epoch level checkpointing logic and ingestion of rewards.

# Summary

Found an issue that is bad in theory but extremely unlikely to manifest in practice. Therefore I rank it low-severity.

- _allocateToElapsedEpochs(uint256 fiduAmount)_ can reward unfinalized epochs for a whole period even if the last checkpoint
  was partway through the epoch
  - **Severity**: Severity: 🟢 Low.
  - **Description**: Rewards are allocated to elapsed epochs and the current epoch proportionally to the total seconds elapsed
    since the last finalized epoch. When the current epoch ends the rewards are allocated to it proportional to the full epoch duration, ignoring the fact that rewards were already
    partially allocated to it. In the most extreme case
    1. Rewards have not been allocated since before the current epoch
    2. block.timestamp = currentEpochStartTimestamp() + EPOCH_DURATION - 1, i.e. 1 second before the end of the epoch
    3. _allocateToElapsedEpochs_ is called and the current epoch receives rewards proportional to (EPOCH_DURATION - 1 second) / totalElapsedTime_1
    4. The current epoch ends
    5. A large repayment comes in
    6. _allocateToElapsedEpochs_ is called again and the previous epoch receives rewards proportional to EPOCH_DURATION / totalElapsedTime_2, resulting in
       an unusually high proportion of rewards allocated to that epoch
  - **Suggested Fix**: Checkpoint based on timestamp instead of based on epoch
  - **Commit**: [36df5ae](https://github.com/warbler-labs/mono/pull/1069/commits/36df5aeb233d19ba1ca3887efc5a24acfd75b2d6)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## Functions

### `allocateToElapsedEpochs`

- If running before the first epoch, all rewards get allocated to the first epoch
- If running during or after the current epoch
  - If the finalizedEpoch cursor hasn't been initialized, initialize it
  - Distribute rewards to each epoch based on the amount of time that's elapsed in in that epoch.

* any remaining rewards are distributed to the finalized epoch

Problem: rewards are over distributed when they "overflow" from one
distribution, and then an epoch is subsequently finalized.

Rewards are distributed at time A

```
|1111111111111111111A
|==========1==========|==========2==========
```

Rewards are distributed at time B, causing epoch A to be finalized and
distributing additional rewards to epoch A and then putting the remaining
rewards in epoch B.

```
|111111111111111111111|22B
|==========1==========|==========2==========
```

This would result in epoch 1 getting overrewarded because it would get the
additional rewards from finalizing the epoch

solution: keep track of a last rewarded timestamp and distribute rewards to the
partially finalized epoch pro-rata.
A1|22B
|==========1==========|==========2==========

### `estimateRewardsFor`

View function used for estimating how many rewards will be or have been
distributed to a given epoch. Not used in any of the contracts besides for tests

### `onReceive`

- validates that the only caller can be the splitter
- Buys fidu

### `finalizeEpochs`

- Can only be called by the membership director
- Calls back to the splitter to distribute
- Prevents calling if the splitter has been called this transaction

## Issues

- 🟢 Rewards are overallocated for epochs that have been overflowed into
