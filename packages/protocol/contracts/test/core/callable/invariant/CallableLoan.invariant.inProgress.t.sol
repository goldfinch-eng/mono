// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {IPoolTokens} from "../../../../interfaces/IPoolTokens.sol";
import {ICallableLoan} from "../../../../interfaces/ICallableLoan.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {IBorrower} from "../../../../interfaces/IBorrower.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {console2 as console} from "forge-std/console2.sol";
import {CallableLoanConstrainedHandler} from "./CallableLoanConstrainedHandler.t.sol";
import {SkipHandler} from "../../../helpers/SkipHandler.t.sol";

contract CallableLoanInProgressInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanConstrainedHandler private handler;
  CallableLoan private loan;
  ISchedule private schedule;

  address[] private depositors;

  function setUp() public override {
    super.setUp();

    (loan, ) = defaultCallableLoan();
    handler = new CallableLoanConstrainedHandler(
      loan,
      usdc,
      uid,
      poolTokens,
      BORROWER,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    schedule = loan.schedule();

    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);

    // Jank way to control distribution of invariant calls
    bytes4[] memory selectors = new bytes4[](100);
    for (uint256 i = 0; i < 12; ++i) {
      selectors[i] = handler.depositTarget.selector;
    }
    for (uint256 i = 12; i < 24; ++i) {
      selectors[i] = handler.withdrawTarget.selector;
    }
    for (uint256 i = 24; i < 36; ++i) {
      selectors[i] = handler.drawdownTarget.selector;
    }
    for (uint256 i = 36; i < 48; ++i) {
      selectors[i] = handler.payTarget.selector;
    }
    for (uint256 i = 48; i < 60; ++i) {
      selectors[i] = handler.submitCallTarget.selector;
    }
    for (uint256 i = 60; i < 65; ++i) {
      selectors[i] = handler.deposit.selector;
    }
    for (uint256 i = 65; i < 70; ++i) {
      selectors[i] = handler.withdraw.selector;
    }
    for (uint256 i = 70; i < 75; ++i) {
      selectors[i] = handler.drawdown.selector;
    }
    for (uint256 i = 75; i < 80; ++i) {
      selectors[i] = handler.pay.selector;
    }
    for (uint256 i = 80; i < 85; ++i) {
      selectors[i] = handler.submitCall.selector;
    }
    for (uint256 i = 85; i < 92; ++i) {
      selectors[i] = handler.skipUpTo7Days.selector;
    }
    for (uint256 i = 92; i < 100; ++i) {
      selectors[i] = handler.skipUpTo100Days.selector;
    }

    targetArtifact("UcuProxy");
    targetContract(address(handler));
    targetSelector(FuzzSelector(address(handler), selectors));

    depositors = new address[](3);
    for (uint256 i = 0; i < 3; ++i) {
      depositors[i] = address(uint160((i + 10)));
      handler.setUpActor(depositors[i]);
      handler.deposit({
        fromActor: depositors[i],
        amount: usdcVal(300_000),
        tranche: loan.uncalledCapitalTrancheIndex()
      });
    }

    handler.drawdown(BORROWER, usdcVal(900_000));
    warpToAfterDrawdownPeriod(loan);
  }

  function invariant_ExpectedPhase() public {
    assertTrue(loan.loanPhase() == LoanPhase.InProgress);
  }

  function invariant_AllInactiveTranchesAreUnfunded() public {
    ICallableLoan.CallRequestPeriod memory period;
    for (
      uint256 i = schedule.principalPeriodAt(loan.termStartTime(), block.timestamp);
      i < 3;
      ++i
    ) {
      assertZero(loan.getCallRequestPeriod(i).principalDeposited);
    }
  }

  function invariant_UnfundedTranchesAreZeroedOut() public {
    ICallableLoan.CallRequestPeriod memory period;
    for (uint256 i = 0; i < 3; ++i) {
      period = loan.getCallRequestPeriod(i);

      if (period.principalDeposited == 0) {
        assertZero(period.principalPaid);
        assertZero(period.principalReserved);
        assertZero(period.interestPaid);
      }
    }
  }

  function invariant_SumPrincipalPaidDoesNotExceedOriginalBalance() public {
    assertLe(handler.sumPrincipalPaid(), usdcVal(900_000));
  }

  function invariant_usdcBalanceMatchesDepositsAndWithdrawals() public {
    uint256 interestLessFees = (handler.sumInterestPaid() * 9) / 10;
    assertApproxEqAbs(
      handler.sumDeposited() -
        handler.sumDrawndown() -
        handler.sumWithdrawn() +
        interestLessFees +
        handler.sumPrincipalPaid(),
      usdc.balanceOf(address(loan)),
      1
    );
  }

  function invariant_CumulativePrincipalPaid() public {
    uint256 totalPrincipalPaidAndReserved = 0;
    for (uint256 i = 0; i < 3; ++i) {
      totalPrincipalPaidAndReserved += loan.getCallRequestPeriod(i).principalPaid;
      totalPrincipalPaidAndReserved += loan.getCallRequestPeriod(i).principalReserved;
    }

    totalPrincipalPaidAndReserved += loan.getUncalledCapitalInfo().principalPaid;
    totalPrincipalPaidAndReserved += loan.getUncalledCapitalInfo().principalReserved;

    assertApproxEqAbs(totalPrincipalPaidAndReserved, handler.sumPrincipalPaid(), 1);
  }

  function invariant_CumulativeInterestPaid() public {
    uint256 totalInterestPaid = 0;
    for (uint256 i = 0; i < 3; ++i) {
      totalInterestPaid += loan.getCallRequestPeriod(i).interestPaid;
    }

    totalInterestPaid += loan.getUncalledCapitalInfo().interestPaid;
    assertApproxEqAbs(totalInterestPaid, handler.sumInterestPaid(), 1);
  }

  function invariant_SubmittingACallDoesNotAffectRedeemableAmounts() public {
    handler.forEachActor(this.assertRedeemableAmountsUnchangedByCallSubmission);
  }

  function assertRedeemableAmountsUnchangedByCallSubmission(
    address actor,
    CallableLoanActorInfo memory info
  ) public {
    for (uint i = 0; i < info.tokens.length; ++i) {
      uint256 tokenId = info.tokens[i];
      if (
        tokenId == handler.lastBurnedCalledPoolTokenId() ||
        tokenId == handler.lastRemainingPoolTokenId() ||
        tokenId == handler.lastCalledPoolTokenId()
      ) {
        continue;
      }

      (uint256 preSnapshotPrincipalRedeemable, uint256 preSnapshotInterestRedeemable) = handler
        .poolTokensePreSubmitCallSnapshot(tokenId);
      (uint256 postSnapshotPrincipalRedeemable, uint256 postSnapshotInterestRedeemable) = handler
        .poolTokensePostSubmitCallSnapshot(tokenId);

      assertApproxEqAbs(preSnapshotPrincipalRedeemable, postSnapshotPrincipalRedeemable, 1);
      assertApproxEqAbs(preSnapshotInterestRedeemable, postSnapshotInterestRedeemable, 1);
    }
  }

  function invariant_CorrectPoolTokenInterestRedeemableAmounts() public {
    handler.forEachActor(this.assertRedeemableInterestAmount);
  }

  function assertRedeemableInterestAmount(address actor, CallableLoanActorInfo memory info) public {
    for (uint i = 0; i < info.tokens.length; ++i) {
      (uint256 interestRedeemable, ) = loan.availableToWithdraw(info.tokens[i]);
      IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(info.tokens[i]);

      uint256 totalPrincipalDepositedInTranche;
      uint256 totalInterestPaidInTranche;
      if (tokenInfo.tranche == loan.uncalledCapitalTrancheIndex()) {
        ICallableLoan.UncalledCapitalInfo memory trancheInfo = loan.getUncalledCapitalInfo();
        totalPrincipalDepositedInTranche = trancheInfo.principalDeposited;
        totalInterestPaidInTranche = trancheInfo.interestPaid;
      } else {
        ICallableLoan.CallRequestPeriod memory trancheInfo = loan.getCallRequestPeriod(
          tokenInfo.tranche
        );
        totalPrincipalDepositedInTranche = trancheInfo.principalDeposited;
        totalInterestPaidInTranche = trancheInfo.interestPaid;
      }

      assertApproxEqAbs(
        (tokenInfo.principalAmount * totalInterestPaidInTranche * 9) /
          (totalPrincipalDepositedInTranche * 10),
        interestRedeemable,
        1
      );
    }
  }

  function invariant_CorrectPoolTokenPrincipalRedeemableAmounts() public {
    handler.forEachActor(this.assertRedeemablePrincipalAmount);
  }

  function assertRedeemablePrincipalAmount(
    address actor,
    CallableLoanActorInfo memory info
  ) public {
    for (uint i = 0; i < info.tokens.length; ++i) {
      (, uint256 principalRedeemable) = loan.availableToWithdraw(info.tokens[i]);
      IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(info.tokens[i]);

      uint256 totalPrincipalDepositedInTranche;
      uint256 totalPrincipalPaidInTranche;
      if (tokenInfo.tranche == loan.uncalledCapitalTrancheIndex()) {
        ICallableLoan.UncalledCapitalInfo memory trancheInfo = loan.getUncalledCapitalInfo();
        totalPrincipalDepositedInTranche = trancheInfo.principalDeposited;
        totalPrincipalPaidInTranche = trancheInfo.principalPaid;
      } else {
        ICallableLoan.CallRequestPeriod memory trancheInfo = loan.getCallRequestPeriod(
          tokenInfo.tranche
        );
        totalPrincipalDepositedInTranche = trancheInfo.principalDeposited;
        totalPrincipalPaidInTranche = trancheInfo.principalPaid;
      }
      assertApproxEqAbs(
        (tokenInfo.principalAmount * totalPrincipalPaidInTranche) /
          totalPrincipalDepositedInTranche,
        principalRedeemable,
        1
      );
    }
  }
}
