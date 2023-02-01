// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

contract SeniorPoolWritedownTest is SeniorPoolBaseTest {
  function testWritedownCallableByNonGovernance(
    address user
  ) public goListed(user) impersonating(user) {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);
    // This should not revert
    sp.writedown(poolToken);
  }

  function testWritedownBeforeLoanEndsWritesDownPrincipalAndDistributesLosses() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    uint256 assetsBefore = sp.assets();
    uint256 sharePriceBefore = sp.sharePrice();
    uint256 totalSharesBefore = fidu.totalSupply();

    sp.writedown(poolToken);

    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, thresholdUsdc());
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, thresholdUsdc());

    uint256 newSharePrice = sp.sharePrice();
    uint256 delta = sharePriceBefore - newSharePrice;
    uint256 normalizedWritedown = sp.usdcToFidu(expectedWritedown);
    uint256 deltaExpected = (normalizedWritedown * sp.fiduMantissa()) / totalSharesBefore;
    assertApproxEqAbs(delta, deltaExpected, thresholdFidu());
    assertTrue(newSharePrice < sharePriceBefore);
    assertApproxEqAbs(newSharePrice, sharePriceBefore - deltaExpected, thresholdFidu());
  }

  function testWritedownShouldDecreaseWritedownAmountForPartialRepayments() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    uint256 assetsBefore = sp.assets();
    uint256 originalSharePrice = sp.sharePrice();
    uint256 originalTotalShares = fidu.totalSupply();

    sp.writedown(poolToken);

    uint256 sharePriceAfterFirstwritedown = sp.sharePrice();
    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, thresholdUsdc());
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, thresholdUsdc());

    // Pay back half of one period
    // tp.assess();
    uint256 interestToPay = cl.interestOwed() / 4; // interestOwed is 2 periods, so 1/4 of that is half-period interest
    uint256 newExpectedWritedown = expectedWritedown / 2;
    payTp(interestToPay, tp);

    sp.writedown(poolToken);

    assertApproxEqAbs(
      sp.totalWritedowns(),
      expectedWritedown - newExpectedWritedown,
      thresholdUsdc()
    );
    assertApproxEqAbs(
      sp.assets(),
      assetsBefore - (expectedWritedown - newExpectedWritedown),
      thresholdUsdc()
    );

    uint256 finalSharePrice = sp.sharePrice();
    uint256 delta = originalSharePrice - finalSharePrice;
    uint256 normalizedWritedown = sp.usdcToFidu(newExpectedWritedown);
    uint256 deltaExpected = (normalizedWritedown * sp.fiduMantissa()) / originalTotalShares;

    assertApproxEqAbs(delta, deltaExpected, thresholdFidu());
    assertTrue(sharePriceAfterFirstwritedown < sp.sharePrice());
    assertApproxEqAbs(sp.sharePrice(), originalSharePrice - deltaExpected, thresholdFidu());
  }

  function testWritedownShouldApplyUsdcInTheCreditLineBeforeWritedown() public {
    // We expect the senior pool to assess the pool before writing it down. This prevents
    // accidentally writing down a pool that has received a payment that is still unapplied

    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    fundAddress(address(cl), usdcVal(100));

    uint256 assetsBefore = sp.assets();
    uint256 writedownsBefore = sp.totalWritedowns();

    sp.writedown(poolToken);

    assertEq(sp.assets(), assetsBefore);
    assertEq(sp.totalWritedowns(), writedownsBefore);
  }

  function testWritedownShouldResetTo0IfFullyPaidBack() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    uint256 sharePriceBefore = sp.sharePrice();
    uint256 assetsBefore = sp.assets();
    uint256 totalWritedownsBefore = sp.totalWritedowns();

    sp.writedown(poolToken);

    assertTrue(sp.sharePrice() < sharePriceBefore);
    assertTrue(sp.assets() < assetsBefore);
    assertTrue(sp.totalWritedowns() > totalWritedownsBefore);
  }

  function testWritedownEmitsEvent() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    // We need the actual writedown to test the event emission because the API
    // doesn't allow asserting approximate values in the events.
    int256 actualWritedown = -19999960;

    vm.expectEmit(true, false, false, true);
    emit PrincipalWrittenDown(address(tp), actualWritedown);

    sp.writedown(poolToken);

    assertEq(uint256(actualWritedown * -1), sp.totalWritedowns());
    assertApproxEqAbs(uint256(actualWritedown * -1), expectedWritedown, thresholdUsdc());
  }

  function testWritedownRevertsIfSpNotTokenOwner() public {
    (TestTranchedPool tp, ) = defaultTp();
    uint256 juniorToken = depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    vm.expectRevert("Only tokens owned by the senior pool can be written down");
    sp.writedown(juniorToken);
  }

  function testWritedownAfterTermEndTimeShouldHaveDaysLateProportionalToFormula() public {
    // Should be proportional to seconds after termEndTime + totalOwed / totalOwedPerDay
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(cl.termEndTime() + 1);

    sp.writedown(poolToken);
    // We're not yet past the grace period so writedown amount is still zero
    assertZero(sp.totalWritedowns());

    // Advance two payment periods past the term end time
    vm.warp(cl.termEndTime() + 2 * (1 days) * cl.paymentPeriodInDays());

    // 60 days past termEndTime + ~1 days late on
    // (interestOwed + principalOwed) / (interestOwedPerDay and principalOwedPerDay)
    // ~= 61 - 30 / 4 = 26%
    uint256 expectedWritedown = (usdcVal(80) * 26) / 100;
    uint256 assetsBefore = sp.assets();
    sp.writedown(poolToken);

    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, 1e17);
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, 1e17);
  }

  function testWritedownSharePriceDoesNotAffectFiduLiquidatedInPreviousEpochs() public {
    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(10_000));
    uint256 requestToken = requestWithdrawalFrom(GF_OWNER, shares);

    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(80));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);
    uint256 sharePriceBefore = sp.sharePrice();

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));
    sp.writedown(poolToken);
    assertTrue(sp.sharePrice() < sharePriceBefore);

    // The fidu should have been liquidated at a share price of 1.00, not the reduced share price, because
    // that liquidation happened in an epoch BEFORE the writedown
    assertEq(sp.withdrawalRequest(requestToken).usdcWithdrawable, usdcVal(10_000));
    assertEq(sp.epochAt(1).fiduLiquidated, fiduVal(10_000));
    assertZero(sp.usdcAvailable());
  }

  /*================================================================================
  Calculate writedown
  ================================================================================*/

  function testCalculateWritedownReturnsWritedownAmount() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));
    tp.assess();

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204

    assertApproxEqAbs(sp.calculateWritedown(poolToken), expectedWritedown, thresholdUsdc());
  }
}
