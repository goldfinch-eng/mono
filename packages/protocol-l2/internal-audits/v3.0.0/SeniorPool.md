# SeniorPool Audit

Auditors: [Dalton](https://github.com/daltyboy11), [Will](https://github.com/wbj-goldfinch), [Sanjay](https://github.com/sanjayprabhu)

# Summary

- Withdrawal request becomes immediately available to withdraw

  - **Severity**: 🟡 Medium
  - **Description**: If the previous epoch was a no-op epoch then the first withdrawal request in the current epoch
    becomes immediately withdrawable. Here is a test to reproduce the bug.

    ```
    // after an epoch ends, users shouldn't immediately have funds withdrawable as soon as they request withdraw
    function testWhenAnEpochCantBeFinalizedAndAMutativeFunctionIsCalledItsExtended() public {
      // unapplied
      depositToSpFrom(GF_OWNER, usdcVal(100));

      uint256 endsAtBeforeWithdrawal = sp.currentEpoch().endsAt;
      vm.warp(endsAtBeforeWithdrawal + 1);

      // extended
      uint256 tokenId = requestWithdrawalFrom(GF_OWNER, fiduVal(100));
      uint256 endsAtAfterWithdrawal = sp.currentEpoch().endsAt;

      assertGt(endsAtAfterWithdrawal, endsAtBeforeWithdrawal);

      ISeniorPoolEpochWithdrawals.WithdrawalRequest memory wr = sp.withdrawalRequest(tokenId);

      // THIS ASSERTION FAILS DUE TO THE BUG
      assertEq(wr.usdcWithdrawable, 0, "user should not have usdc withdrawable before the next epoch");

      vm.warp(endsAtAfterWithdrawal + 100000);

      wr = sp.withdrawalRequest(tokenId);
      assertGt(wr.usdcWithdrawable, 0);
    }
    ```

    The root cause was incorrect short-circuiting logic. At the time of the withdrawal `epoch.fiduRequested == 0`
    evaluates to `true` and we return `(epoch, false)` even though `block.timestamp` evaluates to `false`. This
    returns an epoch with the same `endsAt` timestamp, but `endsAt` should have been extended. This error lead
    to the _\_previewWithdrawRequestCheckpoint_ code incorrectly including the epoch for request liquidation.

    ```
    function _previewEpochCheckpoint(Epoch memory epoch) internal view returns (Epoch memory, bool) {
      if (block.timestamp < epoch.endsAt || _usdcAvailable == 0 || epoch.fiduRequested == 0) {
        return (epoch, false);
      }
      ...
    }
    ```

  - **Suggested Fix**: Fixed in commit [200e2db](https://github.com/warbler-labs/mono/commit/200e2dbd2ae51676903120fa2a605757ee710ab1). Fix [PR](https://github.com/warbler-labs/mono/pull/1163).
  - **Commit**: [8e7ab06](https://github.com/warbler-labs/mono/commit/8e7ab0655e325af9cbb85ad517005f0e9e59d378)

- _setEpochDuration_ allows 0 epoch duration

  - **Severity**: 🟢 Low
  - **Description**: The function allows you to set an invalid epoch duration of 0. Impact is low because only the admins can set it.
  - **Suggested Fix**: Add a require statement to revert if the new epoch duration is 0.
  - **Commit**: [b48bdf0](https://github.com/warbler-labs/mono/pull/1059/commits/b48bdf06d5c0d8ec8f97b67e19500d688ae0bef8)

- _depositWithPermit_ can have `external` visibility

  - **Severity**: 🟢 Low
  - **Description**: The function is `public` but it's called intra-contract so it can be `external`.
  - **Suggested Fix**: Make the function `external`.
  - **Commit**: [b48bdf0](https://github.com/warbler-labs/mono/pull/1059/commits/b48bdf06d5c0d8ec8f97b67e19500d688ae0bef8)

- \_\_previewWithdrawRequestCheckpoint logic very unclear
  - **Severity**: 🟢 Informational
  - **Description**: There is no explanation for the ending index of the for loop, the early return in the loop body,
    or the special logic for `i == _checkpointedEpochId`. None of these are clear to a reader.
  - **Suggested Fix**: Simplify the for loop logic and/or add comments to the loop body.
  - **Commit**: [b48bdf0](https://github.com/warbler-labs/mono/pull/1059/commits/b48bdf06d5c0d8ec8f97b67e19500d688ae0bef8)
