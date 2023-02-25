# MembershipOrchestrator

MembershipOrchestrator.sol analysis

# Summary
The external facing _harvest_ function was added

# Appendix
- Given that harvest is called on each individual position, and each individual position's USDC equivalent
  is "kicked" before the Membership Director's `consumeHoldingsAdjustment` is called, are user rewards that
  should computed based on pre-harvest USDC equivalents actually computed based on the new kicked USDC
  equivalents?
  - This is an important question to ask because if a user harvest to redeem the entire principal on their
    pool token, then its new USDC equivalent would be 0. If their membership rewards from epochs that have
    already elapsed were computed based on this new USDC equivalent, then they would get 0 rewards, which is
    incorrect.
  - The answer is no. Rewards are computed as expected. But it took me a while to come to this conclusion.
  - I suspected something was off because the MembershipOrchestrator iterates over each position id and harvests
    it. This harvesting also "kicks" the position's USDC equivalent. This happens before any epoch reward
    checkpointing occurs.
    - But if we look more closely, the "kicking" process only updates
      - The ledger position's `usdcEquivalent`
      - The user epoch totals' `totalAmount` and `eligibleAmount`
    - And then after the harvesting for loop, `consumeHoldingsAdjustment` allocated rewards based on the
      MembershipVault position id. And at this point, it hasn't been updated based on the new totals, so
      it will allocate rewards based on the pre-kick usdc equivalents
   
- ❓ Missing unit test to test the fn reverts when the contract is paused
- ✅ What happens if I try and harvest with a position I don't own?
  - For each position, the for loop reverts if msg.sender is not the position's owner. Therefore
    the function will revert unless ALL positions are owned by msg.sender
-  What happens if I try and harvest with a position I own, that's duplicated in the list
  - ✅ For StakedFiduAsset?
    - On the first iteration, the GFI rewards are claimed in StakingRewards via
      ```
      positions[tokenId].rewards.claim(reward);
      rewardsToken().safeTransfer(msg.sender, reward);
      ```
      The first line will increase the Rewards storage's totalClaimed by `reward`. If we look at the calculation used for rewards claimable we see that totalClaimed is subtracted from the amount
      ```
      function claimable(Rewards storage rewards) internal view returns (uint256) {
        return rewards.totalVested.add(rewards.totalPreviouslyVested).sub(rewards.totalClaimed);
      }
      ```
      Consequently, the claimable rewards on the second iteration DO NOT INCLUDE the rewards claimed on the
      first iteration.
  - 🟡 For PoolTokensAsset?
    - If I have a duplicated pool token asset, assuming that on the first iteration it has non-zero interest
      and principal redeemable, then it will fail on the second iteration. This is because harvest impl in
      PoolTokensAsset calls `tranchedPool.withdrawMax`, and this reverts if the withdrawable amount is 0. Therefore, harvesting a list of duplicate pool tokens that the caller owns ALWAYS reverts
      - NOTE: I couldn't actually trigger this in a unit test, which is concerning. See
        MembershipOrchestrator.t.sol for detailed explanation

- If I harvest from a smart contract wallet do I receive any callbacks due
  to ERC20 or ERC721 transfers that I can use to re-enter the protocol before the harvest
  fn finishes execution?
  - ✅ Is there an opportunity for re-entrancy when harvesting a PoolToken asset?
    - When harvesting a PoolToken, there is a USDC transfer and GFI transfer to the position owner.
      - GFI's ERC20 implementation has a _\_beforeTokenTransfer_ hook but it's a no-op, so there's no
        possibility of re-entrancy on the GFI transfer
      - USDC's ERC20 implementation does not have any hooks on token transfer, so there's no possibilty
        of re-entrancy on the USDC transfer
      - Could not identify other opportunities for re-entrancy here
  - ✅ Is there an opportunity for re-entrancy when harvesting a StakedFidu asset?
    - When harvesting a StakedFidu position there is a GFI transfer to the position owner.
      - Similar reasoning as above, there is no possibility of re-entrancy here
      - Could not identify other opportunities for re-entrancy here