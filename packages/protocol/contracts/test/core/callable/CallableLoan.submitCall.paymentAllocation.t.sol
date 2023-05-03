// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {console2 as console} from "forge-std/console2.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICallableLoan, LoanPhase} from "../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  CallableLoan callableLoan;
  ICreditLine cl;

  // Used to avoid stack too deep errors in more complicated tests
  uint256 private availableInterest;
  uint256 private availablePrincipal;
  uint256 private calledTokenId;
  uint256 private remainderTokenId;
  uint256 private previousBalance;

  uint256 private constant LIMIT = 100_000_000_000 * 10e6;
  uint256 private constant UNCALLED_CAPITAL_TRANCHE_ID = 3;

  address[4] private USERS = [
    address(uint160(42)),
    address(uint160(43)),
    address(uint160(44)),
    address(uint160(45))
  ];

  function setUp() public override {
    super.setUp();
    (callableLoan, cl) = callableLoanWithLimit(LIMIT);
    for (uint i = 0; i < USERS.length; ++i) {
      uid._mintForTest(USERS[i], 1, 1, "");
    }
  }

  function testPaymentIsAllocatedToCallsCorrectly(
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 paymentAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callAmount = bound(callAmount, 1, drawdownAmount);
    paymentAmount = bound(paymentAmount, 1, drawdownAmount);

    uint256 token = deposit(callableLoan, UNCALLED_CAPITAL_TRANCHE_ID, depositAmount, USERS[0]);

    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    _startImpersonation(BORROWER);

    (availableInterest, availablePrincipal) = callableLoan.availableToWithdraw(token);
    previousBalance = usdc.balanceOf(USERS[0]);

    _startImpersonation(USERS[0]);
    (calledTokenId, remainderTokenId) = callableLoan.submitCall(callAmount, token);
    _stopImpersonation();

    secondsElapsed = bound(
      secondsElapsed,
      1,
      callableLoan.nextDueTimeAt(callableLoan.nextDueTime()) - block.timestamp
    );
    skip(secondsElapsed);

    uint256 totalInterestOwed = callableLoan.interestOwedAt(callableLoan.nextPrincipalDueTime());

    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);

    assertApproxEqAbs(
      poolTokens.getTokenInfo(calledTokenId).principalAmount,
      (depositAmount * callAmount) / drawdownAmount,
      1,
      "Principal amount moved to called pool token is correct"
    );
    assertIsValidUncalledToken(remainderTokenId);

    // If the remainder is under the minimum deposit amount, it is not moved to a new token
    if (remainderTokenId != 0) {
      assertApproxEqAbs(
        poolTokens.getTokenInfo(remainderTokenId).principalAmount,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Principal amount moved to uncalled pool token is correct"
      );
    }

    {
      ICallableLoan.UncalledCapitalInfo memory uncalledCapitalInfo = callableLoan
        .getUncalledCapitalInfo();
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        0
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Uncalled principal deposited"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid,
        (depositAmount - drawdownAmount) -
          (((depositAmount * callAmount) / drawdownAmount) - callAmount),
        1,
        "Uncalled principal paid"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalReserved,
        Math.min(
          paymentAmount.saturatingSub(totalInterestOwed).saturatingSub(callAmount),
          uncalledCapitalInfo.principalDeposited
        ),
        1,
        "Uncalled principal reserved"
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * uncalledCapitalInfo.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Uncalled interest paid"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        (depositAmount * callAmount) / drawdownAmount,
        1,
        "Called principal deposited"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        ((depositAmount * callAmount) / drawdownAmount) - callAmount,
        1,
        "Called principal paid"
      );
      assertApproxEqAbs(
        callRequestPeriod.principalReserved,
        Math.min(
          Math.min(callAmount, paymentAmount.saturatingSub(totalInterestOwed)),
          callRequestPeriod.principalDeposited
        ),
        1,
        "Called principal reserved"
      );
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * callRequestPeriod.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Called interest paid"
      );
      if (uncalledCapitalInfo.principalDeposited > 0) {
        assertOwedAmountsMatch(
          remainderTokenId,
          uncalledCapitalInfo.principalDeposited,
          uncalledCapitalInfo.interestPaid,
          uncalledCapitalInfo.principalPaid
        );
      }
      assertOwedAmountsMatch(
        calledTokenId,
        callRequestPeriod.principalDeposited,
        callRequestPeriod.interestPaid,
        callRequestPeriod.principalPaid
      );
    }

    vm.warp(callableLoan.nextPrincipalDueTime());
    {
      ICallableLoan.UncalledCapitalInfo memory uncalledCapitalInfo = callableLoan
        .getUncalledCapitalInfo();
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        0
      );

      assertZero(uncalledCapitalInfo.principalReserved);
      assertZero(callRequestPeriod.principalReserved);

      if (uncalledCapitalInfo.principalDeposited > 0) {
        assertOwedAmountsMatch(
          remainderTokenId,
          uncalledCapitalInfo.principalDeposited,
          uncalledCapitalInfo.interestPaid,
          uncalledCapitalInfo.principalPaid
        );
      }
      assertOwedAmountsMatch(
        calledTokenId,
        callRequestPeriod.principalDeposited,
        callRequestPeriod.interestPaid,
        callRequestPeriod.principalPaid
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Uncalled principal deposited"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid,
        (depositAmount - drawdownAmount) -
          (((depositAmount * callAmount) / drawdownAmount) - callAmount) +
          Math.min(
            paymentAmount.saturatingSub(totalInterestOwed).saturatingSub(callAmount),
            uncalledCapitalInfo.principalDeposited
          ),
        1,
        "Uncalled principal paid"
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * uncalledCapitalInfo.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Uncalled interest paid"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        (depositAmount * callAmount) / drawdownAmount,
        1,
        "Called principal deposited"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        ((depositAmount * callAmount) / drawdownAmount) -
          callAmount +
          Math.min(
            Math.min(callAmount, paymentAmount.saturatingSub(totalInterestOwed)),
            callRequestPeriod.principalDeposited
          ),
        1,
        "Called principal paid"
      );
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * callRequestPeriod.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Called interest paid"
      );
    }
  }

  function testPaymentIsAllocatedToCallsAcrossAllPaymentPeriods(
    uint256 depositAmount,
    uint256 callAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    uint256 token1 = deposit(callableLoan, UNCALLED_CAPITAL_TRANCHE_ID, depositAmount, USERS[1]);
    uint256 token2 = deposit(callableLoan, UNCALLED_CAPITAL_TRANCHE_ID, depositAmount, USERS[2]);
    uint256 token3 = deposit(callableLoan, UNCALLED_CAPITAL_TRANCHE_ID, depositAmount, USERS[3]);

    // Uncalled token
    deposit(callableLoan, UNCALLED_CAPITAL_TRANCHE_ID, depositAmount, USERS[0]);

    uint256 drawdownAmount = depositAmount * 4;
    uint256 principalOutstanding = drawdownAmount;
    callAmount = bound(callAmount, 1000, drawdownAmount / 4);
    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);

    _startImpersonation(USERS[1]);
    (uint256 calledTokenId, uint256 uncalledTokenId) = callableLoan.submitCall(callAmount, token1);
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    _startImpersonation(USERS[2]);
    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token2);
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    _startImpersonation(USERS[3]);
    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token3);
    assertIsValidUncalledToken(uncalledTokenId);

    _startImpersonation(BORROWER);
    // Make payment amount less than fully owed so we can verify that all tranches are paid and that
    // some of the uncalled tranche remains unpaid
    uint256 totalInterestOwed = callableLoan.interestOwed();
    uint256 paymentAmount = totalInterestOwed + callableLoan.principalOwed() - 100;
    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);
    _stopImpersonation();

    // Check uncalled capital tranche index
    {
      ICallableLoan.UncalledCapitalInfo memory uncalledCapitalInfo = callableLoan
        .getUncalledCapitalInfo();

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        drawdownAmount - callAmount * 3,
        1,
        "Uncalled principal deposited"
      );

      assertZero(uncalledCapitalInfo.principalReserved);
      assertZero(uncalledCapitalInfo.principalPaid);

      // Interest is pro-rata
      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (totalInterestOwed * uncalledCapitalInfo.principalDeposited) / principalOutstanding,
        HUNDREDTH_CENT, // Margin of error increases slightly for each call request period
        "Uncalled interest paid"
      );
    }

    // Check the first call request period tranche
    {
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        0
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        callAmount,
        1,
        "Called principal deposited 0"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        callRequestPeriod.principalDeposited,
        1,
        "Called principal paid 0"
      );

      assertZero(callRequestPeriod.principalReserved);
      // Interest is pro-rata
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (totalInterestOwed * callRequestPeriod.principalDeposited) / principalOutstanding,
        HUNDREDTH_CENT, // Margin of error increases slightly for each call request period
        "callRequestPeriod 0 interest paid"
      );
    }

    {
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        1
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        callAmount,
        1,
        "Called principal deposited 1"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        callRequestPeriod.principalDeposited - 100,
        1,
        "Called principal paid 1"
      );

      assertZero(callRequestPeriod.principalReserved);
      // Interest is pro-rata
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (totalInterestOwed * callRequestPeriod.principalDeposited) / principalOutstanding,
        HUNDREDTH_CENT, // Margin of error increases slightly for each call request period
        "callRequestPeriod 1 interest paid"
      );
    }

    // The final call tranche was not fully paid
    {
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        2
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        callAmount,
        1,
        "Called principal deposited 2"
      );

      assertZero(callRequestPeriod.principalPaid);
      assertZero(callRequestPeriod.principalReserved);
      // Interest is pro-rata
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (totalInterestOwed * callRequestPeriod.principalDeposited) / principalOutstanding,
        HUNDREDTH_CENT, // Margin of error increases slightly for each call request period
        "callRequestPeriod 2 interest paid"
      );
    }
  }

  function assertOwedAmountsMatch(
    uint256 tokenId,
    uint256 principalDepositedInTranche,
    uint256 interestPaidInTranche,
    uint256 principalPaidInTranche
  ) internal {
    (uint256 availableInterest, uint256 availablePrincipal) = callableLoan.availableToWithdraw(
      tokenId
    );
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    assertApproxEqAbs(
      availableInterest,
      (interestPaidInTranche *
        tokenInfo.principalAmount *
        (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / (principalDepositedInTranche * 100),
      1,
      "Owed interest matches"
    );

    assertApproxEqAbs(
      availablePrincipal,
      ((principalPaidInTranche * tokenInfo.principalAmount) / principalDepositedInTranche) -
        tokenInfo.principalRedeemed,
      1,
      "Owed principal matches"
    );
  }

  /// @notice Assert that a token belongs to the uncalled capital tranche
  function assertIsValidUncalledToken(uint256 tokenId) private {
    // Token ID == 0 means no token was created
    if (tokenId == 0) {
      return;
    }
    assertEq(
      poolTokens.getTokenInfo(tokenId).tranche,
      3,
      "Uncalled pool token should be uncalled capital tranche"
    );
  }
}
