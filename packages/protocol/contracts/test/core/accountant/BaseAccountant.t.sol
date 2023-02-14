// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {FixedPoint} from "../../../external/FixedPoint.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {BaseTest} from "../../core/BaseTest.t.sol";
import {TestCreditLine} from "../../../test/TestCreditLine.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";

contract AccountantBaseTest is BaseTest {
  using FixedPoint for FixedPoint.Unsigned;

  uint256 internal constant TOLERANCE = 1e18 / 1000; // $0.001
  address internal constant BORROWER = 0x228994aE78d75939A5aB9260a83bEEacBE77Ddd0;
  uint256 internal constant INTEREST_APR = 300000000000000000; // 3%
  uint256 internal constant PAYMENT_PERIOD_IN_DAYS = 30;
  uint256 internal constant TERM_IN_DAYS = 365;
  uint256 internal constant LATE_FEE_APR = 30000000000000000; // 3%
  uint256 internal constant GRACE_PERIOD_IN_DAYS = 1000 days;

  TestCreditLine internal cl;
  GoldfinchConfig internal gfConfig;

  function setUp() public override {
    super.setUp();

    // GoldfinchConfig setup
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    cl = new TestCreditLine();
    ISchedule schedule = defaultSchedule();
    cl.initialize({
      _config: address(gfConfig),
      owner: GF_OWNER,
      _borrower: BORROWER,
      _maxLimit: usdcVal(10_000_000), // max limit
      _interestApr: INTEREST_APR,
      _schedule: schedule,
      _lateFeeApr: LATE_FEE_APR
    });

    vm.startPrank(GF_OWNER);
    cl.setBalance(usdcVal(10_000_00));
    vm.stopPrank();

    fuzzHelper.exclude(address(gfConfig));
    fuzzHelper.exclude(address(cl));
    fuzzHelper.exclude(address(schedule));
    fuzzHelper.exclude(address(Schedule(address(schedule)).periodMapper()));
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      createMonthlySchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function createMonthlySchedule(
    uint periodsInTerm,
    uint periodsPerPrincipalPeriod,
    uint periodsPerInterestPeriod,
    uint gracePrincipalPeriods
  ) public returns (ISchedule) {
    return
      new Schedule({
        _periodMapper: new MonthlyPeriodMapper(),
        _periodsInTerm: periodsInTerm,
        _periodsPerInterestPeriod: periodsPerInterestPeriod,
        _periodsPerPrincipalPeriod: periodsPerPrincipalPeriod,
        _gracePrincipalPeriods: gracePrincipalPeriods
      });
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
    TestCreditLine cl,
    uint256 gracePeriodInDays,
    uint256 maxDaysLate
  ) internal returns (FixedPoint.Unsigned memory) {
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
  ) internal pure returns (uint256) {
    uint256 paymentPeriodInSeconds = _paymentPeriodInDays * TestConstants.SECONDS_PER_DAY;
    uint256 totalInterestPerYear = (_balance * _interestApr) / TestConstants.INTEREST_DECIMALS;
    uint256 result = (totalInterestPerYear * paymentPeriodInSeconds) /
      TestConstants.SECONDS_PER_YEAR;
    return result;
  }

  modifier withBalance(TestCreditLine cl, uint256 _balance) {
    cl.setBalance(_balance);
    _;
  }

  modifier withLateFeeApr(TestCreditLine cl, uint256 _lateFeeApr) {
    cl.setLateFeeApr(_lateFeeApr);
    _;
  }

  modifier withInterestApr(TestCreditLine cl, uint256 _interestApr) {
    cl.setInterestApr(_interestApr);
    _;
  }

  modifier withInterestOwed(TestCreditLine cl, uint256 _interestOwed) {
    // TODO(will)
    // cl.setInterestOwed(_interestOwed);
    _;
  }

  modifier withLastFullPaymentTime(TestCreditLine cl, uint256 _lastFullPaymentTime) {
    // TODO(will)
    // cl.setLastFullPaymentTime(_lastFullPaymentTime);
    _;
  }
}
