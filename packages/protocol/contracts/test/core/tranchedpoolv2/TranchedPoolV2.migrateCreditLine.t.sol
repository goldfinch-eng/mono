// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {IV3CreditLine} from "../../../interfaces/IV3CreditLine.sol";
import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2MigrateCreditLineTest is TranchedPoolV2BaseTest {
  event CreditLineMigrated(
    IV3CreditLine indexed oldCreditLine,
    IV3CreditLine indexed newCreditLine
  );

  function testMigrateCreditLineRejectsNonOwner(address nonOwner) public {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(nonOwner));

    vm.expectRevert("Must have admin role to perform this action");
    pool.migrateCreditLine(BORROWER, 0, 0, 0, 0, 0, 0);
  }

  function testMigrateCreditLineCreatesNewCreditLineAndCopiesVarsOver() public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    // We could migrate the credit line immediately, but we'll do a more complicated
    // example with funding and a drawdown to verify it works in that case.

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    // Deposit
    deposit(pool, 2, usdcVal(1_000_000), DEPOSITOR);

    // Lock pool and drawdown
    lockAndDrawdown(pool, usdcVal(100));

    // Advance time so some interest is owed
    vm.warp(block.timestamp + periodInSeconds(pool));

    _startImpersonation(GF_OWNER);
    IV3CreditLine oldCl = IV3CreditLine(address(cl));
    usdc.transfer(address(oldCl), usdcVal(20));
    uint256 oldClBalance = oldCl.balance();
    uint256 oldClTotalInterestAccrued = oldCl.totalInterestAccrued();
    uint256 oldClPrincipalOwed = oldCl.principalOwed();
    uint256 oldClLimit = oldCl.limit();
    vm.expectEmit(true, false, false, false, address(pool));
    emit CreditLineMigrated(
      oldCl,
      IV3CreditLine(computeCreateAddress(address(gfFactory), vm.getNonce(address(gfFactory))))
    );
    pool.migrateCreditLine(
      DEPOSITOR,
      // Slightly change params so we can verify the new credit line is set with new params
      poolBuilder.DEFAULT_MAX_LIMIT() * 2,
      poolBuilder.DEFAULT_APR() * 2,
      poolBuilder.DEFAULT_PERIOD_IN_DAYS() * 3,
      poolBuilder.DEFAULT_TERM_IN_DAYS(),
      poolBuilder.DEFAULT_LATE_APR() * 4,
      poolBuilder.DEFAULT_PRINCIPAL_GRACE_PERIOD_DAYS() * 5
    );
    _stopImpersonation();

    IV3CreditLine newCl = pool.creditLine();

    // Params on the new cl should match what was passed in to the migration function
    assertEq(newCl.maxLimit(), poolBuilder.DEFAULT_MAX_LIMIT() * 2);
    assertEq(newCl.interestApr(), poolBuilder.DEFAULT_APR() * 2);
    assertEq(newCl.paymentPeriodInDays(), poolBuilder.DEFAULT_PERIOD_IN_DAYS() * 3);
    assertEq(newCl.termInDays(), poolBuilder.DEFAULT_TERM_IN_DAYS());
    assertEq(newCl.lateFeeApr(), poolBuilder.DEFAULT_LATE_APR() * 4);
    assertEq(
      newCl.principalGracePeriodInDays(),
      poolBuilder.DEFAULT_PRINCIPAL_GRACE_PERIOD_DAYS() * 5
    );

    // Other variables on the new cl should match the ones on the old cl
    assertEq(newCl.balance(), oldClBalance);
    assertEq(newCl.totalInterestPaid(), oldCl.totalInterestPaid());
    assertEq(newCl.totalInterestAccrued(), oldClTotalInterestAccrued);
    assertEq(newCl.principalOwed(), oldClPrincipalOwed);
    assertEq(newCl.lastFullPaymentTime(), oldCl.lastFullPaymentTime());
    assertEq(newCl.limit(), oldClLimit);

    // The pool's credit line should no longer point to the old one
    assertTrue(address(newCl) != address(oldCl));

    // Balance was transferred over
    assertZero(usdc.balanceOf(address(oldCl)));
    assertEq(usdc.balanceOf(address(newCl)), usdcVal(20));

    // depositor should have locker role
    assertFalse(pool.hasRole(pool.LOCKER_ROLE(), BORROWER));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), DEPOSITOR));
  }
}
