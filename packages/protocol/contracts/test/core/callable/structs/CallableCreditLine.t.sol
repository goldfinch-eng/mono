// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
// solhint-disable-next-line max-line-length
import {StaleCallableCreditLine, StaleCallableCreditLineLogic, CallableCreditLine, CallableCreditLineLogic} from "../../../../protocol/core/callable/structs/CallableCreditLine.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../../../protocol/core/schedule/PaymentSchedule.sol";
import {Tranche, TrancheLogic} from "../../../../protocol/core/callable/structs/Waterfall.sol";
import {IMonthlyScheduleRepo} from "../../../../interfaces/IMonthlyScheduleRepo.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {BaseTest} from "../../BaseTest.t.sol";

using StaleCallableCreditLineLogic for StaleCallableCreditLine;
using CallableCreditLineLogic for CallableCreditLine;
using PaymentScheduleLogic for PaymentSchedule;

using TrancheLogic for Tranche;

contract TestCallableCreditLine is BaseTest {
  uint256 public constant DEFAULT_LIMIT = 1_000_000 * 1e6;
  uint256 public constant DEFAULT_APR = 5 * 1e16;
  uint256 public constant DEFAULT_LATE_ADDITIONAL_APR = 1 * 1e16;

  StaleCallableCreditLine internal callableCreditLine;
  IGoldfinchConfig internal config;
  IMonthlyScheduleRepo private monthlyScheduleRepo;
  ISchedule private schedule;

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
    callableCreditLine.initialize(
      config,
      DEFAULT_APR,
      schedule,
      DEFAULT_LATE_ADDITIONAL_APR,
      DEFAULT_LIMIT
    );
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    assertEq(address(cpcl._config), address(config));
    assertEq(address(cpcl._paymentSchedule.schedule), address(schedule));
    assertEq(cpcl.interestApr(), DEFAULT_APR);
    assertEq(cpcl.lateFeeAdditionalApr(), DEFAULT_LATE_ADDITIONAL_APR);
    assertEq(cpcl.limit(), DEFAULT_LIMIT);
  }

  // TODO
  function testDeposit(uint128 depositAmount) public {
    setupDefaultWithLimit(depositAmount);
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    cpcl.deposit(depositAmount);
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), depositAmount);
    assertEq(cpcl.principalOutstanding(), 0);
    assertEq(cpcl.totalInterestAccrued(), 0);
    assertEq(cpcl.interestOwed(), 0);
  }

  function testDrawdown(uint128 depositAmount, uint128 drawdownAmount) public {
    setupDefaultWithLimit(depositAmount);
    drawdownAmount = boundUint128(drawdownAmount, 0, depositAmount);
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    cpcl.deposit(depositAmount);
    cpcl.drawdown(drawdownAmount);
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), depositAmount - drawdownAmount);
    assertEq(cpcl.principalOutstanding(), drawdownAmount);
    assertEq(cpcl.totalInterestAccrued(), 0);
    assertEq(cpcl.interestOwed(), 0);
  }

  // TODO: Test pay when there is no cash drawndown.
  function testPay(uint128 depositAmount, uint128 interest, uint128 principal) public {
    depositAmount = boundUint128(depositAmount, 1, type(uint128).max);
    setupFullyFundedAndDrawndown(depositAmount);
    interest = boundUint128(interest, 0, depositAmount);
    principal = boundUint128(principal, 0, depositAmount - interest);
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    console.log("1");
    cpcl.pay(uint256(interest), uint256(principal));
    console.log("2");
    // TODO: Assert that principal is buffered
    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), 0);
    assertEq(cpcl.principalOutstanding(), depositAmount);

    console.log("3");
    // TODO: Assert that interest is buffered
    assertEq(cpcl.totalInterestAccrued(), 0);
    assertEq(cpcl.interestOwed(), 0);
  }

  // TODO: Test call where called amount is 0
  function testCall(uint128 depositAmount, uint128 calledAmount) public {
    depositAmount = boundUint128(depositAmount, 1, type(uint128).max);
    calledAmount = boundUint128(calledAmount, 1, depositAmount);
    setupFullyFundedAndDrawndown(depositAmount);
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    console.log("1");
    vm.warp(cpcl._paymentSchedule.startTime);
    cpcl.submitCall(calledAmount);
    console.log("2");

    assertEq(cpcl.totalPrincipalDeposited(), depositAmount);
    assertEq(cpcl.totalPrincipalPaid(), 0);
    assertEq(cpcl.principalOutstanding(), depositAmount);

    console.log("3");

    assertEq(cpcl.totalInterestAccrued(), 0);
    console.log("4");
    assertEq(cpcl.interestOwed(), 0);
    assertEq(
      cpcl.totalPrincipalOwedAt(cpcl._paymentSchedule.startTime + atLeast6Months),
      calledAmount
    );
    assertEq(
      cpcl.totalPrincipalOwedAt(cpcl._paymentSchedule.nextPrincipalDueTimeAt(block.timestamp)),
      calledAmount
    );
  }

  function testWithdraw() public {}

  /**
   * Test cases
   * S = Start B = Buffer Applied At L = Late Fees Start At E = End
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

  function testEarliestPrincipalOutstandingTrancheIndex() public {}

  // TODO
  function testIsLate() public {}

  function setupDefaultWithLimit(uint128 limit) public {
    callableCreditLine.initialize(config, defaultInterestApr, schedule, 0, uint256(limit));
  }

  function setupFullyFundedAndDrawndown(uint128 limit) public {
    setupDefaultWithLimit(limit);
    CallableCreditLine storage cpcl = callableCreditLine.checkpoint();
    cpcl.deposit(uint256(limit));
    cpcl.drawdown(uint256(limit));
  }

  // Interest calculations and accounting after repayment
  // 1. Calculation of interest accrual over time without accounting for repayments.
  // 2. Calculation of interest accrual over time accounting for late fees
  // 3. Attempt to overpay interest obligations - Reject(?) Should not be able to pay off more than interest owed
  // 5. Underpay interest obligations - interest paid should be paid down by payment amount
  // 6. Pay off entirety of loan
  // 7. Pay off more than entirety of loan.

  // Payment waterfall calculations
  // 1. Pay off all interest + principal obligations
  // 2. Pay off all interest obligations
  // 3. Pay off portion of interest obligations
  // 4. Pay off portion of interest obligations, principal obligations
  // 5. Attempt to only pay off principal obligations when existing interest obligations exist - should fail
  // 6. Attempt to pay off more than all obligations - should fail or account towards excess balance

  // Test principal calculations
  // 1. Overpay past due principal obligations - some should buffer, some should go to principal paid
  // 2. Underpay past due principal obligations - all should go to principal paid
  // 3. Pay off entirety of principal obligations, both past due and from current call request tranche.
  //    Principal paid should be all the way paid down and buffer should receive rest.
  // 4. Pay off entirety of loan. Principal paid should be all the way paid down and buffer should receive rest.
  // 5. Attempt to pay off more than entirety of loan. Should fail or account towards excess balance
}
