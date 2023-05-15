# PoolTokensAsset

PoolTokensAsset.sol analysis

# Summary
The main focus here was analyzing _isValid_. Can a pool token that is valid at time t_1, and therefore vaultable
at time t_1, become invalid at t_2, where t1 < t2? If so, then a vaulted pool token could become locked in the
vault. My answer is no, it's not possible. See my reasoning in the appendix.

No issues were found.

# Appendix
- _isValid_
  - Can a pool token that was once valid become invalid? If so, would that lock the pool token in membership?
    - I believe it's not possible for a valid pool token to become invalid. To answer the q, we must determine
      if `lockedUntil` can be set to 0 from some non-zero amount. If it can, then a pool token that was once
      valid and vaulted could become invalid.

      `lockedUntil` gets set in two code paths
      1. In _TranchingLogic#initializeNextSlice_, where it's set to 0
      2. In _TranchingLogic#lockTranche_, where it's set to a non-zero amount

      Let's focus on _initializeNextSlice_ because that's the only place it can be set to 0. Can a tranche whose `lockedUntil` is non-zero (i.e. was set via _lockTranche_) be overwritten to 0 via _initializeNextSlice_?

      The answer is no, because the pool's slice counter is incremented whenever a slice is initialized:
      ```
      TranchingLogic.initializeNextSlice(_poolSlices, numSlices);
      numSlices = numSlices.add(1);
      ```

      Therefore, _initializeNextSlice_ is never called more than once
      on the same slice index. 

      And for a particular slice, _initializeNextSlice_ is always called **before** _lockTranche_ on that slice.

      For the first slice, _initializeNextSlice_ is called during pool creation/initialization, so there's no change
      to lock the tranches of that slice before it's initialized. For subsequent slices, you must call _initializeNextSlice_
      and update the slice index before you can call _lockJuniorCapital_ or _lockPool_ on that slice index. So we can combine
      those two facts

      1. _initializeNextSlice_ is never called more than once for a slice index
      2. The one time _initializeNextSlice_ is called for a slice index, it happens **before** _lockTranche_ can be called on
         the tranches in that slice index.

      And conclude that if a pool token is valid then it cannot become invalid.
