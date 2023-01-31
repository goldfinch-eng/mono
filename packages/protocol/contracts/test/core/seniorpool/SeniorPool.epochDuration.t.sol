// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";

contract SeniorPoolEpochDurationTest is SeniorPoolBaseTest {
  function testSetEpochDurationCheckpointsElapsedNoOpEpochsCorrectly() public {
    /*
    Currently we have epoch duration of two weeks
    v- week 0(last checkpoint)
    | 2 weeks | 2 weeks | [we are here] 2 weeks | <--- endsAt

    We to make sure that the new endsAt timestamp is based off the endsAt of the previous
    epoch even if hasn't been checkpointed.
    v- week 0 (last checkpoint)
    | 2 weeks | 2 weeks | [we are here]| 5 weeks           | <--- endsAt = week 9
    */
    uint256 initialStartsAt = sp.epochAt(1).endsAt - sp.epochDuration();
    vm.warp(block.timestamp + 30 days);
    _startImpersonation(GF_OWNER);
    sp.setEpochDuration(5 weeks);
    assertEq(sp.epochAt(1).endsAt, initialStartsAt + 9 weeks);
  }

  function testSetEpochDurationCheckpointsCorrectlyWhenNewDurationLtOldDuration(
    uint256 numberOfNoopEpochs,
    uint256 newEpochDuration,
    uint256 offset
  ) public {
    vm.assume(newEpochDuration > 0);
    vm.assume(numberOfNoopEpochs < 100_000_000);
    vm.assume(offset < sp.epochDuration());
    vm.assume(newEpochDuration < sp.epochDuration());
    uint256 initialEndsAt = sp.epochAt(1).endsAt;
    uint256 endOfEpochsWithPreviousDuration = initialEndsAt +
      sp.epochDuration() *
      numberOfNoopEpochs;
    vm.warp(endOfEpochsWithPreviousDuration + offset);

    _startImpersonation(GF_OWNER);
    sp.setEpochDuration(newEpochDuration);

    uint256 nextEpochEndsAt = sp.currentEpoch().endsAt;

    // The new epoch
    assertGt(nextEpochEndsAt, block.timestamp);
    assertZero((nextEpochEndsAt - endOfEpochsWithPreviousDuration) % newEpochDuration);
  }

  function testSetEpochDurationCheckpointsElapsedEpochsCorrectly() public {
    // Like the previous test but now that there's a withdrawal request we
    // expect the epoch id to update as well.
    uint256 initialStartsAt = sp.epochAt(1).endsAt - sp.epochDuration();
    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(1));
    requestWithdrawalFrom(GF_OWNER, shares);
    vm.warp(block.timestamp + 30 days);
    _startImpersonation(GF_OWNER);
    sp.setEpochDuration(5 weeks);
    assertEq(sp.epochAt(2).endsAt, initialStartsAt + 9 weeks);
  }

  function testSetEpochDurationWorksForAdmin(uint256 epochDuration) public impersonating(GF_OWNER) {
    epochDuration = bound(epochDuration, 1 days, 10 weeks);
    vm.assume(epochDuration != sp.epochDuration());
    sp.setEpochDuration(epochDuration);
    assertEq(sp.epochDuration(), epochDuration);
  }

  function testSetEpochDurationReversForNonAdmin(
    address user
  ) public onlyAllowListed(user) impersonating(user) {
    vm.expectRevert("Must have admin role to perform this action");
    sp.setEpochDuration(1 days);
  }

  function testSetEpochDurationEmitsEpochDurationChanged(
    uint256 epochDuration
  ) public impersonating(GF_OWNER) {
    epochDuration = bound(epochDuration, 1 days, 10 weeks);
    vm.assume(epochDuration != sp.epochDuration());
    vm.expectEmit(false, false, false, true);
    emit EpochDurationChanged(epochDuration);
    sp.setEpochDuration(epochDuration);
  }

  function testSetEpochDurationRevertsForZeroDuration() public impersonating(GF_OWNER) {
    vm.expectRevert("Zero duration");
    sp.setEpochDuration(0);
  }

  function testEpochDurationReturnsCorrectDuration() public {
    assertEq(sp.epochDuration(), 2 weeks);
  }

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

    assertEq(
      wr.usdcWithdrawable,
      0,
      "user should not have usdc withdrawable before the next epoch"
    );

    vm.warp(endsAtAfterWithdrawal + 100000);

    wr = sp.withdrawalRequest(tokenId);
    assertGt(wr.usdcWithdrawable, 0);
  }

  function testSeniorPoolEmitsAnEpochExtendedEventAfterANopEpoch(
    address user,
    // number of epochs that have passed
    uint256 nNoopEpochs,
    // Add a random offset within the epoch
    uint256 subEpochOffset
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    nNoopEpochs = bound(nNoopEpochs, 1, 100_000_000);
    subEpochOffset = bound(subEpochOffset, 0, sp.epochDuration() - 1);
    uint256 depositAmount = usdcVal(1);
    fundAddress(user, depositAmount);

    uint256 epochDuration = sp.epochDuration();
    uint256 epochEndsAt = sp.currentEpoch().endsAt;
    uint256 newEpochStart = epochEndsAt + nNoopEpochs * epochDuration;
    uint256 expectedNewEndsAt = newEpochStart + epochDuration;
    vm.warp(newEpochStart + subEpochOffset);

    vm.expectEmit(true, false, false, true);
    emit EpochExtended(1, expectedNewEndsAt, epochEndsAt);
    depositToSpFrom(user, depositAmount);
  }
}
