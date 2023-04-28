pragma solidity ^0.8.0;

import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {CallableBorrower, CallableLender} from "./CallableScenarioActor.t.sol";

contract CallableLoanMultiQuarterScenario is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  CallableLoan callableLoan;
  ICreditLine creditLine;
  CallableLender[4] lenders;
  CallableBorrower borrower;

  uint256 totalDeposits;
  uint256 drawdownTime;

  function setupDepositorsAndLenders(
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 depositAmount4,
    uint256 drawdownAmount
  ) private {
    totalDeposits = depositAmount1 + depositAmount2 + depositAmount3 + depositAmount4;

    borrower = new CallableBorrower(usdc);

    (callableLoan, ) = callableLoanWithLimit(totalDeposits);

    (callableLoan, creditLine) = callableLoanBuilder
      .withLimit(totalDeposits)
      .withApr(145 * 1e15)
      .build(address(borrower));

    borrower.setLoan(callableLoan);
    lenders[0] = new CallableLender(callableLoan, usdc);
    lenders[1] = new CallableLender(callableLoan, usdc);
    lenders[2] = new CallableLender(callableLoan, usdc);
    lenders[3] = new CallableLender(callableLoan, usdc);

    _startImpersonation(GF_OWNER);
    gfConfig.addToGoList(address(borrower));
    gfConfig.addToGoList(address(lenders[0]));
    gfConfig.addToGoList(address(lenders[1]));
    gfConfig.addToGoList(address(lenders[2]));
    gfConfig.addToGoList(address(lenders[3]));

    usdc.transfer(address(borrower), usdcVal(1_000_000_000));
    usdc.transfer(address(lenders[0]), usdcVal(1_000_000_000));
    usdc.transfer(address(lenders[1]), usdcVal(1_000_000_000));
    usdc.transfer(address(lenders[2]), usdcVal(1_000_000_000));
    usdc.transfer(address(lenders[3]), usdcVal(1_000_000_000));
    _stopImpersonation();

    lenders[0].deposit(depositAmount1);
    lenders[1].deposit(depositAmount2);
    lenders[2].deposit(depositAmount3);
    lenders[3].deposit(depositAmount4);

    borrower.drawdown(totalDeposits);
    warpToAfterDrawdownPeriod(callableLoan);
  }

  /// Make deposits for each user (4 users)
  /// Submit 1st call for the first call request period
  /// Make full payments each interest period and then the call principal
  /// Submit 2nd call for the second call request period
  /// Make full payments each interest period and then the call principal
  /// Submit 3rd call for the third call request period
  /// Make full payments each interest period and then the call principal
  function testMultiCallRequestPeriodsHappy(
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 depositAmount4,
    uint256 callAmount1,
    uint256 callAmount2,
    uint256 callAmount3,
    uint256 drawdownAmount
  ) public {
    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(100_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(100_000_000));
    depositAmount3 = bound(depositAmount3, usdcVal(1), usdcVal(100_000_000));
    depositAmount4 = bound(depositAmount4, usdcVal(1), usdcVal(100_000_000));

    setupDepositorsAndLenders(
      depositAmount1,
      depositAmount2,
      depositAmount3,
      depositAmount4,
      drawdownAmount
    );

    {
      uint256 availableToCall = callableLoan.availableToCall(lenders[0].tokenIds(0));
      assertApproxEqAbs(availableToCall, depositAmount1, 1, "Available to call - 1");
      callAmount1 = bound(callAmount1, 1, availableToCall);
    }
    submitCallAndCheckOtherTokens({
      callAmount: callAmount1,
      lenderIndexToCall: 0,
      tokenIndexToCall: 0
    });
    fullyPayThisQuarter();

    {
      uint256 availableToCall = callableLoan.availableToCall(lenders[1].tokenIds(0));
      assertApproxEqAbs(availableToCall, depositAmount2, HUNDREDTH_CENT, "Available to call - 2");
      callAmount2 = bound(callAmount2, 1, availableToCall);
    }
    submitCallAndCheckOtherTokens({
      callAmount: callAmount2,
      lenderIndexToCall: 1,
      tokenIndexToCall: 0
    });

    fullyPayThisQuarter();

    {
      uint256 availableToCall = callableLoan.availableToCall(lenders[2].tokenIds(0));
      assertApproxEqAbs(availableToCall, depositAmount3, HUNDREDTH_CENT, "Available to call - 3");
      callAmount3 = bound(callAmount3, 1, availableToCall);
    }
    submitCallAndCheckOtherTokens({
      callAmount: callAmount3,
      lenderIndexToCall: 2,
      tokenIndexToCall: 0
    });
    fullyPayThisQuarter();
  }

  /// Make deposits for each user (4 users)
  /// Submit 1st call for the first call request period
  /// Make full payments each interest period and then the call principal
  /// Submit 2nd call for the second call request period
  /// Make late payemnt for principal payment period
  /// Submit 3rd call for the third call request period
  /// Make full payments each interest period and then the call principal
  function testMultiCallRequestPeriodsPayLate1(
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 depositAmount4,
    uint256 callAmount1,
    uint256 callAmount2,
    uint256 callAmount3,
    uint256 drawdownAmount
  ) public {}

  function fullyPayThisQuarter() private {
    borrower.pay(callableLoan.interestOwedAt(callableLoan.nextDueTime()));

    vm.warp(callableLoan.nextDueTime());
    borrower.pay(callableLoan.interestOwedAt(callableLoan.nextDueTime()));

    vm.warp(callableLoan.nextDueTime());
    borrower.pay(
      callableLoan.interestOwedAt(callableLoan.nextDueTime()) +
        callableLoan.principalOwedAt(callableLoan.nextDueTime())
    );

    vm.warp(callableLoan.nextDueTime());

    assertZero(callableLoan.principalOwed());
    assertZero(callableLoan.interestOwed());
  }

  function submitCallAndCheckOtherTokens(
    uint256 callAmount,
    uint256 lenderIndexToCall,
    uint256 tokenIndexToCall
  ) private {
    uint256[][] memory availableToWithdraw = new uint256[][](lenders.length);
    for (uint256 i = 0; i < lenders.length; i++) {
      availableToWithdraw[i] = new uint256[](lenders[i].tokenIdsLength());
      if (i != lenderIndexToCall) {
        for (uint256 j = 0; j < lenders[i].tokenIdsLength(); j++) {
          (uint256 interest, uint256 principal) = lenders[i].availableToWithdraw(
            lenders[i].tokenIds(j)
          );
          availableToWithdraw[i][j] = interest + principal;
        }
      }
    }
    lenders[lenderIndexToCall].submitCall(
      callAmount,
      lenders[lenderIndexToCall].tokenIds(tokenIndexToCall)
    );

    for (uint256 i = 0; i < lenders.length; i++) {
      if (i != lenderIndexToCall) {
        for (uint256 j = 0; j < lenders[i].tokenIdsLength(); j++) {
          (uint256 interest, uint256 principal) = lenders[i].availableToWithdraw(
            lenders[i].tokenIds(j)
          );
          assertApproxEqAbs(
            availableToWithdraw[i][j],
            interest + principal,
            HUNDREDTH_CENT,
            "Available to withdraw"
          );
        }
      }
    }
  }
}
