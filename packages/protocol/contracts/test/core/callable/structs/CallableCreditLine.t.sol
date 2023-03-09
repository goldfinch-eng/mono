// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "forge-std/Test.sol";
// solhint-disable-next-line max-line-length
import {CallableCreditLine, CallableCreditLineLogic, PreviewCallableCreditLineLogic, CheckpointedCallableCreditLineLogic} from "../../../../protocol/core/callable/structs/CallableCreditLine.sol";
// solhint-disable-next-line max-line-length
import {StaleCallableCreditLine, StaleCallableCreditLineLogic} from "../../../../protocol/core/callable/structs/StaleCallableCreditLine.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../../../protocol/core/schedule/PaymentSchedule.sol";
import {CallableLoanConfigHelper} from "../../../../protocol/core/callable/CallableLoanConfigHelper.sol";
import {IMonthlyScheduleRepo} from "../../../../interfaces/IMonthlyScheduleRepo.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";
import {BaseTest} from "../../BaseTest.t.sol";

using StaleCallableCreditLineLogic for StaleCallableCreditLine;
using CallableCreditLineLogic for CallableCreditLine;
using PreviewCallableCreditLineLogic for CallableCreditLine;
using CheckpointedCallableCreditLineLogic for CallableCreditLine;
using PaymentScheduleLogic for PaymentSchedule;
using CallableLoanConfigHelper for IGoldfinchConfig;

contract TestCallableCreditLine is BaseTest {
  uint256 internal constant HUNDREDTH_CENT = 1e6 / 10000;
  uint256 public constant DEFAULT_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_LATE_ADDITIONAL_APR = 1 * 1e16;
  uint256 public constant DEFAULT_NUM_LOCKUP_PERIODS = 2;
  StaleCallableCreditLine internal staleCreditLine;
  IGoldfinchConfig internal config;
  IMonthlyScheduleRepo private monthlyScheduleRepo;
  ISchedule private schedule;

  uint256 fundableAt;
  uint256 constant defaultInterestApr = 1000;
  uint256 constant firstDepositor = 0x64;
  uint256 constant atLeast6Months = 6 * 31 days;

  function setUp() public override {
    super.setUp();
    monthlyScheduleRepo = IMonthlyScheduleRepo(deployCode("MonthlyScheduleRepo.sol"));
    config = IGoldfinchConfig(deployCode("GoldfinchConfig.sol"));
    monthlyScheduleRepo.createSchedule({
      periodsInTerm: 36,
      periodsPerInterestPeriod: 1,
      periodsPerPrincipalPeriod: 3,
      gracePrincipalPeriods: 0
    });
    schedule = defaultSchedule();
    fundableAt = block.timestamp + 1 days;
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      monthlyScheduleRepo.getSchedule({
        periodsInTerm: 36,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 3,
        gracePrincipalPeriods: 0
      });
  }

  function testInitialize() public {
    staleCreditLine.initialize({
      _config: config,
      _fundableAt: fundableAt,
      _numLockupPeriods: DEFAULT_NUM_LOCKUP_PERIODS,
      _schedule: schedule,
      _interestApr: DEFAULT_APR,
      _lateAdditionalApr: DEFAULT_LATE_ADDITIONAL_APR,
      _limit: DEFAULT_LIMIT
    });
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    assertEq(address(cpcl._config), address(config));
    assertEq(address(cpcl._paymentSchedule.schedule), address(schedule));
    assertEq(cpcl.interestApr(), DEFAULT_APR);
    assertEq(cpcl.lateFeeAdditionalApr(), DEFAULT_LATE_ADDITIONAL_APR);
    assertEq(cpcl.limit(), DEFAULT_LIMIT);
  }

  function testDeposit(uint128 depositAmount) public {
    setupDefaultWithLimit(depositAmount);
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    cpcl.deposit(depositAmount);
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), depositAmount);
    assertEq(cpcl.totalPrincipalOutstanding(), 0);
    assertEq(cpcl.totalInterestAccrued(), 0);
    assertEq(cpcl.interestOwed(), 0);
  }

  function testDrawdown(uint128 depositAmount, uint128 drawdownAmount) public {
    setupDefaultWithLimit(depositAmount);
    drawdownAmount = boundUint128(drawdownAmount, 0, depositAmount);
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    cpcl.deposit(depositAmount);
    cpcl.drawdown(drawdownAmount);
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), depositAmount - drawdownAmount);
    assertEq(cpcl.totalPrincipalOutstanding(), drawdownAmount);
    assertEq(cpcl.totalInterestAccrued(), 0);
    assertEq(cpcl.interestOwed(), 0);
  }

  function testPay(uint128 depositAmount, uint128 interest, uint128 principal) public {
    depositAmount = boundUint128(depositAmount, 1, type(uint128).max);
    setupFullyFundedAndDrawndown(depositAmount);
    interest = boundUint128(interest, 0, depositAmount);
    principal = boundUint128(principal, 0, depositAmount - interest);

    vm.warp(staleCreditLine.termStartTime() + config.getDrawdownPeriodInSeconds() + 1);
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    cpcl.pay({principalPayment: uint256(principal), interestPayment: uint256(interest)});

    assertEq(cpcl.totalPrincipalDeposited(), depositAmount, "principal deposited");
    // Principal should be reserved not paid yet
    assertEq(cpcl.totalPrincipalPaid(), 0, "principal paid");
    assertEq(cpcl.totalPrincipalOutstanding(), depositAmount - principal, "principal outstanding");
    assertEq(cpcl.totalInterestPaid(), interest, "interest paid");

    vm.warp(cpcl.nextPrincipalDueTime());
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount, "principal deposited  after settling");
    // Principal should be now paid
    assertEq(
      cpcl.totalPrincipalOutstanding(),
      depositAmount - principal,
      "principal outstanding  after settling"
    );
    assertEq(cpcl.totalInterestPaid(), interest, "interest paid  after settling");
  }

  function testSubmitCall(uint128 depositAmount, uint128 calledAmount) public {
    depositAmount = boundUint128(depositAmount, 1, type(uint128).max);
    calledAmount = boundUint128(calledAmount, 1, depositAmount);
    setupFullyFundedAndDrawndown(depositAmount);
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    vm.warp(cpcl.termStartTime() + config.getDrawdownPeriodInSeconds() + 1);
    cpcl.submitCall(calledAmount);

    // assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    // assertEq(cpcl.totalPrincipalPaid(), 0);
    // assertEq(cpcl.totalPrincipalOutstanding(), depositAmount);

    // assertEq(cpcl.totalInterestAccrued(), 0);
    // assertEq(cpcl.interestOwed(), 0);
    // assertEq(
    //   cpcl.totalPrincipalOwedAt(cpcl._paymentSchedule.startTime + atLeast6Months),
    //   calledAmount
    // );
    // assertEq(
    //   cpcl.totalPrincipalOwedAt(cpcl._paymentSchedule.nextPrincipalDueTimeAt(block.timestamp)),
    //   calledAmount
    // );
  }

  // TODO:
  function testWithdraw() public {}

  /**
   * Test cases
   * S = Start B = Buffer Applied At L = Late Fees Start At E = End
   TODO:
    SBLE
    SBEL
    SLEB
    SLBE
    SELB
    SEBL

    LSEB
    LSBE
    LBSE(INVALID)
    LBES(INVALID)
    LESB(INVALID)
    LEBS(INVALID) 

    BSLE (INVALID)
    BSEL (INVALID)
    BLSE (INVALID)
    BLES (INVALID)
    BESL (INVALID)
    BELS (INVALID)
   */
  function testTotalInterestAccruedAt() public {}

  function setupDefaultWithLimit(uint128 limit) public {
    staleCreditLine.initialize({
      _config: config,
      _fundableAt: fundableAt,
      _numLockupPeriods: DEFAULT_NUM_LOCKUP_PERIODS,
      _schedule: schedule,
      _interestApr: defaultInterestApr,
      _lateAdditionalApr: 0,
      _limit: uint256(limit)
    });
  }

  function setupFullyFundedAndDrawndown(uint128 limit) public {
    setupDefaultWithLimit(limit);
    CallableCreditLine storage cpcl = staleCreditLine.checkpoint();
    cpcl.deposit(uint256(limit));
    cpcl.drawdown(uint256(limit));
  }
}
