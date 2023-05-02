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

    uint256 token = deposit(callableLoan, 3, depositAmount, USERS[0]);

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

    // Assert uncalled capital info
    // Assert call request period
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
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    uint256 token1 = deposit(callableLoan, 3, depositAmount, USERS[1]);
    uint256 token2 = deposit(callableLoan, 3, depositAmount, USERS[2]);
    uint256 token3 = deposit(callableLoan, 3, depositAmount, USERS[3]);

    // Uncalled token
    deposit(callableLoan, 3, depositAmount, USERS[0]);

    drawdownAmount = bound(drawdownAmount, usdcVal(1), depositAmount);
    uint256 principalOutstanding = drawdownAmount;
    callAmount = bound(callAmount, 4, drawdownAmount / 4);
    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    _startImpersonation(BORROWER);
    _stopImpersonation();

    _startImpersonation(USERS[0]);
    (uint256 calledTokenId, uint256 uncalledTokenId) = callableLoan.submitCall(callAmount, token1);
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token2);
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token3);
    assertIsValidUncalledToken(uncalledTokenId);

    uint256 paymentAmount = callableLoan.interestOwed() + callableLoan.principalOwed();
    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);

    // TODO: Make assertions that all tranches have been paid
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
