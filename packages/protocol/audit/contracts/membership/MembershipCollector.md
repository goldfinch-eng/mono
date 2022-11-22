# MembershipCollector

Handles epoch level checkpointing logic and ingestion of rewards.

## Functions

### `allocateToElapsedEpochs`
* If running before the first epoch, all rewards get allocated to the first epoch
* If running during or after the current epoch
  - If the finalizedEpoch cursor hasn't been initialized, initialize it
  - Distribute rewards to each epoch based on the amount of time that's elapsed in in that epoch.
- any remaining rewards are distributed to the finalized epoch

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

* validates that the only caller can be the splitter
* Buys fidu

### `finalizeEpochs`
* Can only be called by the membership director
* Calls back to the splitter to distribute
* Prevents calling if the splitter has been called this transaction

## Issues
* 🟢 Rewards are overallocated for epochs that have been overflowed into