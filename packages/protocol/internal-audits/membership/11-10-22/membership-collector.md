# MembershipCollector
Auditor: [Dalton](https://github.com/daltyboy11)

MembershipCollector.sol audit

# Summary

Found an issue that is bad in theory but extremely unlikely to manifest in practice. Therefore I rank it low-severity.

* _allocateToElapsedEpochs(uint256 fiduAmount)_ can reward unfinalized epochs for a whole period even if the last checkpoint
  was partway through the epoch
  * **Severity**: Severity: 🟢 Low.
  * **Description**: Rewards are allocated to elapsed epochs and the current epoch proportionally to the total seconds elapsed
  since the last finalized epoch. When the current epoch ends the rewards are allocated to it proportional to the full epoch duration, ignoring the fact that rewards were already
  partially allocated to it. In the most extreme case
    1. Rewards have not been allocated since before the current epoch
    2. block.timestamp = currentEpochStartTimestamp() + EPOCH_DURATION - 1, i.e. 1 second before the end of the epoch
    3. _allocateToElapsedEpochs_ is called and the current epoch receives rewards proportional to (EPOCH_DURATION - 1 second) / totalElapsedTime_1
    4. The current epoch ends
    5. A large repayment comes in
    6. _allocateToElapsedEpochs_ is called again and the previous epoch receives rewards proportional to EPOCH_DURATION / totalElapsedTime_2, resulting in
    an unusually high proportion of rewards allocated to that epoch
  * **Suggested Fix**: Checkpoint based on timestamp instead of based on epoch
  * **Commit**: [36df5ae](https://github.com/warbler-labs/mono/pull/1069/commits/36df5aeb233d19ba1ca3887efc5a24acfd75b2d6)
