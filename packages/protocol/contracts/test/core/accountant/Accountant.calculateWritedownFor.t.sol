// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {FixedPoint} from "../../../external/FixedPoint.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {AccountantBaseTest} from "./BaseAccountant.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ITranchedPool} from "../../../interfaces/ICreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract MockCreditLine is ICreditLine {
  uint256 private _balance;
  uint256 private _interestOwed;
  uint256 private _principalOwed;
  uint256 private _termEndTime;
  uint256 private _nextDueTime;
  uint256 private _interestAccruedAsOf;
  uint256 private _lastFullPaymentTime;
  address private _borrower;
  uint256 private _limit;
  uint256 private _interestApr;
  uint256 private _lateFeeApr;
  bool private _isLate;
  bool private _withinPrincipalGracePeriod;
  uint256 private _totalInterestAccrued;
  uint256 private _totalInterestAccruedAt;
  uint256 private _totalInterestPaid;
  uint256 private _totalInterestOwed;
  uint256 private _totalInterestOwedAt;
  uint256 private _interestOwedAt;
  uint256 private _interestAccrued;
  uint256 private _interestAccruedAt;
  uint256 private _principalOwedAt;
  uint256 private _totalPrincipalPaid;
  uint256 private _totalPrincipalOwedAt;
  uint256 private _totalPrincipalOwed;
  uint256 private _termStartTime;

  function balance() external view override returns (uint256) { return _balance; }
  function interestOwed() external view override returns (uint256) { return _interestOwed; }
  function principalOwed() external view override returns (uint256) { return _principalOwed; }
  function termEndTime() external view override returns (uint256) { return _termEndTime; }
  function nextDueTime() external view override returns (uint256) { return _nextDueTime; }
  function interestAccruedAsOf() external view override returns (uint256) { return _interestAccruedAsOf; }
  function lastFullPaymentTime() external view override returns (uint256) { return _lastFullPaymentTime; }
  function borrower() external view override returns (address) { return _borrower; }
  function currentLimit() external view override returns (uint256) { return _limit; }
  function limit() external view override returns (uint256) { return _limit; }
  function maxLimit() external view override returns (uint256) { return _interestApr; }
  function interestApr() external view override returns (uint256) { return _interestApr; }
  function lateFeeApr() external view override returns (uint256) { return _lateFeeApr; }
  function isLate() external view override returns (bool) { return _isLate; }
  function withinPrincipalGracePeriod() external view override returns (bool) { return _withinPrincipalGracePeriod; }
  function totalInterestAccrued() external view override returns (uint256) { return _totalInterestAccrued; }
  function totalInterestAccruedAt(uint256) external view override returns (uint256) { return _totalInterestAccruedAt; }
  function totalInterestPaid() external view override returns (uint256) { return _totalInterestPaid; }
  function totalInterestOwed() external view override returns (uint256) { return _totalInterestOwed; }
  function totalInterestOwedAt(uint256) external view override returns (uint256) { return _totalInterestOwedAt; }
  function interestOwedAt(uint256) external view override returns (uint256) { return _interestOwedAt; }
  function interestAccrued() external view override returns (uint256) { return _interestAccrued; }
  function interestAccruedAt(uint256) external view override returns (uint256) { return _interestAccruedAt; }
  function principalOwedAt(uint256) external view override returns (uint256) { return _principalOwedAt; }
  function totalPrincipalPaid() external view override returns (uint256) { return _totalPrincipalPaid; }
  function totalPrincipalOwedAt(uint256) external view override returns (uint256) { return _totalPrincipalOwedAt; }
  function totalPrincipalOwed() external view override returns (uint256) { return _totalPrincipalOwed; }
  function termStartTime() external view override returns (uint256) { return _termStartTime; }
  function setLimit(uint256) external override {}
  function setMaxLimit(uint256) external override {}
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr
  ) external override {}
  function pay(uint paymentAmount) external override returns (ITranchedPool.PaymentAllocation memory) {}
  function pay(
    uint256 principalPayment,
    uint256 interestPaymen
  ) external override returns (ITranchedPool.PaymentAllocation memory) {}
  function drawdown(uint256 amount) external override {}

  function setTermEndTime(uint256 __termEndTime) external {
    _termEndTime = __termEndTime;
  }

  function setBalance(uint256 __balance) external {
    _balance = __balance;
  }

  function setInterestOwed(uint256 __interestOwed) external {
    _interestOwed = __interestOwed;
  }

  function setPrincipalOwed(uint256 __principalOwed) external {
    _principalOwed = __principalOwed;
  }

  function setInterestApr(uint256 __interestApr) external {
    _interestApr = __interestApr;
  }
}

contract AccountantCalculateWritedownForTest is AccountantBaseTest {
  using FixedPoint for FixedPoint.Unsigned;

  uint256 private TOLERANCE = 10 ** TestConstants.USDC_DECIMALS / 1000; // $0.001

  MockCreditLine private cl;

  function setUp() public override {
    super.setUp();
    cl = new MockCreditLine();
  }

  /*
  If we are past the termEndTime, owe interest and/or balance, and past the writedown gracePeriod,
  then the principal should be written down proportionally to how close we are to maxDaysLate
  */
  function testWritedownWhenPaymentPeriodGtGracePeriodInDays() public {
    cl.setBalance(usdcVal(10));
    cl.setInterestApr(30000000000000000);
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: 30 days,
      amount: cl.balance(),
      apr: cl.interestApr()
    }));
    cl.setTermEndTime(block.timestamp);

    // Calculate for 100 seconds in the future
    vm.warp(block.timestamp + 100);
    // 10 gracePeriodInDays
    // 120 maxDaysLate
    // 30 daysLate
    // Expected writedown %: (daysLate - gracePeriod) / maxDaysLate = (30 - 10) / 120 = 16.67%
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      10, // gracePeriodInDays
      120 // maxDaysLate
    );
    assertEq(writedownPercent, 16, "writedownPercent should be 50%");
    assertApproxEqAbs(
      writedownAmount,
      cl.balance() * 1667 / 10000,
      TOLERANCE,
      "writedownAmount should be half the balance"
    );
  }

  /*
  If we are past termEndTime, owe interest and/or balance, and before the grace period,
  then the principal should not be written down
  */
  function testZeroWritedownWithinGracePeriod(uint256 gracePeriodInDays, uint256 daysOfInterestOwed) public {
    cl.setTermEndTime(block.timestamp + 1);
    // Set gracePeriodInDays within reasonable bounds
    gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
    daysOfInterestOwed = bound(daysOfInterestOwed, 0, gracePeriodInDays);

    cl.setBalance(usdcVal(100));
    cl.setInterestApr(30000000000000000);
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: daysOfInterestOwed * 1 days,
      amount: cl.balance(),
      apr: cl.interestApr()
    }));

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      gracePeriodInDays
    );

    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  /*
  If we are past the termEndTime, owe interest and/or balance, and past the gracePeriod,
  then the principal should be written down proportionally to how close we are to maxDaysLate
  */
  function testWritedownLinearlyAfterGracePeriod(uint256 daysOfInterestOwed) public {
    cl.setTermEndTime(block.timestamp + 1);

    uint256 gracePeriodInDays = 15;
    uint256 maxDaysLate = 40;
    daysOfInterestOwed = bound(daysOfInterestOwed, gracePeriodInDays + 1, maxDaysLate + gracePeriodInDays);

    cl.setBalance(usdcVal(100));
    cl.setInterestApr(30000000000000000);
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: daysOfInterestOwed * 1 days,
      amount: cl.balance(),
      apr: cl.interestApr()
    }));

    log("HERE 1");
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    log("HERE 2");

    FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
      cl,
      gracePeriodInDays,
      maxDaysLate
    );

    log("HERE 3");

    assertEq(
      writedownPercent,
      expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
      "writedown percent should be proportional"
    );

    uint256 expectedWritedownAmount = expectedWritedownPercent
      .mul(cl.balance())
      .div(10 ** 18)
      .rawValue;

    assertEq(writedownAmount, expectedWritedownAmount, "writedown amount should be proportional");
  }

  /*
  If the daysLate exceeds maxDaysLate then the writedownPercent should be capped at 100%
  */
  function testWritedownCapsAt100PercentAfterMaxDaysLate(uint256 daysLate) public {
    cl.setBalance(usdcVal(100));
    cl.setInterestApr(30000000000000000);
    // termEndTime is in the future because this test doesn't want to include termEndTime
    // writedown logic
    cl.setTermEndTime(block.timestamp + 1);

    uint256 gracePeriodInDays = 15;
    uint256 maxDaysLate = 40;
    vm.assume(daysLate > maxDaysLate + gracePeriodInDays && daysLate <= maxDaysLate * 100);
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: daysLate * (1 days),
      amount: cl.balance(),
      apr: cl.interestApr()
    }));

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(writedownPercent, 100, "writedownPercent should be 100");
    assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  }

  /*
  If there is no balance on the credit line then nothing should be written down,
  even if there is interest/principal owed
  */
  function testIfZeroBalanceThenZeroWritedown(uint256 daysOfInterestOwed) public {
    cl.setBalance(0);
    cl.setTermEndTime(block.timestamp);
    cl.setInterestApr(30000000000000000);

    uint256 gracePeriodInDays = 15;
    uint256 maxDaysLate = 40;
    vm.assume(daysOfInterestOwed > gracePeriodInDays && daysOfInterestOwed <= 500);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  /*
  When past termEndTime the current timestamp should be used to determine if we're in the
  grace period
  */
  function testWritedownUsesTimestampToCheckIfInGracePeriodPastTermEndTime() public {
    cl.setBalance(usdcVal(100));
    cl.setInterestApr(30000000000000000);
    cl.setTermEndTime(block.timestamp);
    cl.setInterestOwed(getInterestAccrued(0, 1 days, cl.balance(), cl.interestApr()));

    skip(block.timestamp + 30 days / 2);
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(
      writedownPercent,
      0,
      "writedown percent should be 0 within grace period after termEndTime"
    );
    assertEq(
      writedownAmount,
      0,
      "writedown amount should be 0 within grace period after termEndTime"
    );
  }

  /*
  Crossing the termEndTime should not be a significant event, in that the writedown is computed
  the same as if we crossed an arbitrary point in time
  */
  function testWritedownNoChangeWhenYouJustCrossTermEndTime() public {
    cl.setBalance(usdcVal(10));
    cl.setTermEndTime(block.timestamp + 2);
    cl.setInterestApr(30000000000000000);
    cl.setInterestOwed(interestOwedForOnePeriod(cl.balance(), cl.interestApr(), 30) * 2);

    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    uint256 timestamp = block.timestamp; // 2 seconds before termEndTime
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should be 25");
    assertApproxEqAbs(
      writedownAmount,
      (cl.balance() * 25) / 100,
      TOLERANCE,
      "writedownAmount should be 25% of balance"
    );
    timestamp = block.timestamp + 2; // 1 second after termEndTerm
    (writedownPercent, writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should still be 25");
    assertApproxEqAbs(
      writedownAmount,
      (cl.balance() * 25) / 100,
      TOLERANCE,
      "writedownAmount should still be 25% of balance"
    );
  }

  /*
  We should have proportional writedowns after termEndTime, same as before. The
  main difference here is that daysLate will include the seconds elapsed after termEndTime.
  */
  function testWritedownPastTermEndTimeUsesTimestampToWritedownLinearly(uint256 daysAfterTermEndTime) public {
    cl.setTermEndTime(block.timestamp);
    cl.setBalance(usdcVal(100));
    cl.setInterestApr(usdcVal(30000000000000000));
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: 30 days + 10,
      amount: cl.balance(),
      apr: cl.interestApr() 
    }));

    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;

    // daysLate = 30 (from interest owed) + daysAfterTermEndTime
    // we want days late to fall in the range [gracePeriodInDays, maxDaysLate]
    // to test writedown proportionality, so
    // 30 + daysAfterTermEndTime > gracePeriodInDays && 30 + daysAfterTermEndTime < maxDaysLate
    // => daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90
    vm.assume(daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
      cl,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(
      writedownPercent,
      expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
      "writedownPercent should be proportional"
    );

    uint256 expectedWritedownAmount = expectedWritedownPercent
      .mul(cl.balance())
      .div(10 ** 18)
      .rawValue;

    assertEq(writedownAmount, expectedWritedownAmount, "writedownAmount should be proportional");
  }

  /*
  Just like before termEndTime, the writedown percent should not exceed 100% under
  any circumstances
  */
  function testWritedownPastTermEndTimeCapsAt100Percent(uint256 daysAfterTermEndTime) public {
    cl.setTermEndTime(block.timestamp);
    cl.setInterestOwed(getInterestAccrued({
      start: 0,
      end: 30 days,
      amount: usdcVal(10),
      apr: 30000000000000000
    }));
    cl.setBalance(usdcVal(100));
    cl.setPrincipalOwed(usdcVal(100));

    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    daysAfterTermEndTime = bound(daysAfterTermEndTime, 150, 500);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(writedownPercent, 100, "writedownPercent should be 100");
    assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  }

  /*
  Past termEndTime nothing should be written down if the credit line has no balance
  */
  function testNoWritedownForZeroBalancePastTermEndTime(
    uint256 daysAfterTermEndTime
  ) public impersonating(GF_OWNER) withTermEndTime(cl, block.timestamp) withBalance(cl, 0) {
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    daysAfterTermEndTime = bound(daysAfterTermEndTime, gracePeriodInDays, 500);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  modifier withTermEndTime(MockCreditLine cl, uint256 _termEndTime) {
    cl.setTermEndTime(_termEndTime);
    _;
  }

  modifier withBalance(MockCreditLine cl, uint256 _balance) {
    cl.setBalance(_balance);
    _;
  }

  function getInterestAccrued(
    uint256 start,
    uint256 end,
    uint256 amount,
    uint256 apr
  ) internal pure returns (uint256) {
    uint256 secondsElapsed = end - start;
    uint256 totalIntPerYear = (amount * apr) / TestConstants.INTEREST_DECIMALS;
    return (totalIntPerYear * secondsElapsed) / TestConstants.SECONDS_PER_YEAR;
  }

   function getPercentage(
    MockCreditLine cl,
    uint256 gracePeriodInDays,
    uint256 maxDaysLate
  ) internal view returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory fpGracePeriod = FixedPoint.fromUnscaledUint(gracePeriodInDays);
    FixedPoint.Unsigned memory fpMaxDaysLate = FixedPoint.fromUnscaledUint(maxDaysLate);

    FixedPoint.Unsigned memory amountOwedForOneDay = Accountant.calculateAmountOwedForOneDay(cl);
    uint256 totalOwed = cl.interestOwed() + cl.principalOwed();
    FixedPoint.Unsigned memory fpDaysLate = FixedPoint.fromUnscaledUint(totalOwed).div(
      amountOwedForOneDay
    );
    if (block.timestamp > cl.termEndTime()) {
      uint256 secondsLate = block.timestamp - cl.termEndTime();
      fpDaysLate = fpDaysLate.add(
        FixedPoint.fromUnscaledUint(secondsLate).div(TestConstants.SECONDS_PER_DAY)
      );
    }
    FixedPoint.Unsigned memory expectedWritedownPercent = fpDaysLate.sub(fpGracePeriod).div(
      fpMaxDaysLate
    );
    return expectedWritedownPercent;
  }

  function interestOwedForOnePeriod(
    uint256 _balance,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays
  ) public pure returns (uint256) {
    uint256 paymentPeriodInSeconds = _paymentPeriodInDays * TestConstants.SECONDS_PER_DAY;
    uint256 totalInterestPerYear = (_balance * _interestApr) / TestConstants.INTEREST_DECIMALS;
    uint256 result = (totalInterestPerYear * paymentPeriodInSeconds) /
      TestConstants.SECONDS_PER_YEAR;
    return result;
  }
}
