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
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {IBorrower} from "../../../../interfaces/IBorrower.sol";
import {console2 as console} from "forge-std/console2.sol";
import {CallableLoanConstrainedHandler} from "./CallableLoanConstrainedHandler.t.sol";

contract CallableLoanDrawdownPeriodInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanConstrainedHandler private handler;
  CallableLoan loan;

  function setUp() public override {
    super.setUp();

    (loan, ) = callableLoanBuilder.build(address(BORROWER));
    handler = new CallableLoanConstrainedHandler(
      loan,
      usdc,
      uid,
      poolTokens,
      BORROWER,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );

    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);

    bytes4[] memory selectors = new bytes4[](7);
    selectors[0] = handler.depositTarget.selector;
    selectors[1] = handler.withdrawTarget.selector;
    selectors[2] = handler.warpBeforeInProgressTarget.selector;
    selectors[3] = handler.drawdownTarget.selector;
    selectors[4] = handler.drawdown.selector;
    selectors[5] = handler.submitCall.selector;
    selectors[6] = handler.pay.selector;

    targetSelector(FuzzSelector(address(handler), selectors));
  }

  // PoolTokens TokenInfo invariants
  function invariant_PoolTokenPrincipalAndInterestRedeemedIsZero() public {
    handler.forEachActor(this.assertPoolTokenInfoPrincipalAndInterestRedeemedIsZero);
  }

  function invariant_PoolTokenPoolIsCallableLoan() public {
    handler.forEachActor(this.assertPoolTokenInfoPoolIsCallableLoan);
  }

  function invariant_PoolTokenTrancheIsUncalledCapitalTranche() public {
    handler.forEachActor(this.assertPoolTokenInfoTrancheIsUncalledCapitalTranche);
  }

  function assertPoolTokenInfoPrincipalAndInterestRedeemedIsZero(
    address actor,
    CallableLoanActorInfo memory info
  ) external {
    for (uint i = 0; i < info.tokens.length; ++i) {
      assertZero(poolTokens.getTokenInfo(info.tokens[i]).principalRedeemed);
      assertZero(poolTokens.getTokenInfo(info.tokens[i]).interestRedeemed);
    }
  }

  function assertPoolTokenInfoPoolIsCallableLoan(
    address actor,
    CallableLoanActorInfo memory info
  ) external {
    for (uint i = 0; i < info.tokens.length; ++i) {
      assertEq(poolTokens.getTokenInfo(info.tokens[i]).pool, address(handler.loan()));
    }
  }

  function assertPoolTokenInfoTrancheIsUncalledCapitalTranche(
    address actor,
    CallableLoanActorInfo memory info
  ) external {
    for (uint i = 0; i < info.tokens.length; ++i) {
      assertEq(
        poolTokens.getTokenInfo(info.tokens[i]).tranche,
        handler.loan().uncalledCapitalTrancheIndex()
      );
    }
  }

  function assertPoolTokenInfoHasntChangedSinceDrawdown(
    address actor,
    CallableLoanActorInfo memory info
  ) external {
    // Only make these assertions when we are in the drawdown period
    if (!handler.hasDrawndown()) {
      return;
    }
    for (uint i = 0; i < info.tokens.length; ++i) {
      tokenInfoUnchangedSinceTimeOfDrawdown(info.tokens[i]);
    }
  }

  function tokenInfoUnchangedSinceTimeOfDrawdown(uint256 tokenId) private view returns (bool) {
    IPoolTokens.TokenInfo memory a;
    {
      a = poolTokens.getTokenInfo(tokenId);
    }

    IPoolTokens.TokenInfo memory b;
    {
      (
        address pool,
        uint256 tranche,
        uint256 principalAmount,
        uint256 principalRedeemed,
        uint256 interestRedeemed
      ) = handler.poolTokensAtTimeOfFirstDrawdown(tokenId);
      b = IPoolTokens.TokenInfo(
        pool,
        tranche,
        principalAmount,
        principalRedeemed,
        interestRedeemed
      );
    }
    return
      a.pool == b.pool &&
      a.tranche == b.tranche &&
      a.principalAmount == b.principalAmount &&
      a.principalRedeemed == b.principalRedeemed &&
      a.interestRedeemed == b.interestRedeemed;
  }

  // PoolTokens PoolInfo invariants

  function invariant_PoolTokensPoolInfoTotalMintedIsSumOfPrincipalAmounts() public {
    assertEq(
      poolTokens.getPoolInfo(address(handler.loan())).totalMinted,
      handler.reduceActors(0, this.poolTokenPrincipalAmountReducer)
    );
  }

  function invariant_PoolTokensPoolInfoTotalPrincipalRedeemedIsZero() public {
    assertZero(poolTokens.getPoolInfo(address(handler.loan())).totalPrincipalRedeemed);
  }

  // LoanPhase transition invariant
  function invariant_loanPhaseIsDrawdownPeriodAfterDrawdown() public {
    assertEq(handler.loan().loanPhase() == LoanPhase.DrawdownPeriod, handler.hasDrawndown());
  }

  // USDC balances
  function invariant_callableLoanBalanceAfterDrawdown() public {
    if (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
      console.log(
        "callableLoanBalanceBeforeFirstDrawdown:",
        handler.callableLoanBalanceBeforeFirstDrawdown()
      );
      console.log("handler.sumDrawndown:", handler.sumDrawndown());
      assertEq(
        usdc.balanceOf(address(loan)),
        handler.callableLoanBalanceBeforeFirstDrawdown() - handler.sumDrawndown()
      );
    }
  }

  function invariant_borrowerBalanceAfterDrawdown() public {
    if (loan.loanPhase() == LoanPhase.DrawdownPeriod) {
      assertEq(
        usdc.balanceOf(BORROWER),
        handler.borrowerBalanceBeforeFirstDrawdown() + handler.sumDrawndown()
      );
    }
  }

  // Tranche invariants
  function invariant_UncalledCapitalInfoPrincipalDepositedIsSumOfPrincipalWithdrawable() public {
    uint256 totalPrincipalDeposited = handler.reduceActors(0, this.principalDepositedReducer);
    assertEq(handler.loan().getUncalledCapitalInfo().principalDeposited, totalPrincipalDeposited);
  }

  function invariant_UncalledCapitalInfoPrincipalPaidIsPrincipalDepositedLessDrawdowns() public {
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalPaid,
      handler.loan().getUncalledCapitalInfo().principalDeposited - handler.sumDrawndown()
    );
  }

  function invariant_UncalledCapitalInfoPrincipalReservedIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().principalReserved);
  }

  function invariant_UncalledCapitalInfoInterestPaidIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().interestPaid);
  }

  function invariant_AllCalledTranchesAreZeroedOut() public {
    for (uint256 i = 0; i < 3; ++i) {
      assertZero(handler.loan().getCallRequestPeriod(i).principalDeposited);
      assertZero(handler.loan().getCallRequestPeriod(i).principalPaid);
      assertZero(handler.loan().getCallRequestPeriod(i).principalReserved);
      assertZero(handler.loan().getCallRequestPeriod(i).interestPaid);
    }
  }

  function principalWithdrawableReducer(
    uint256 principalWithdrawableAcc,
    address actor,
    CallableLoanActorInfo memory info
  ) external view returns (uint256) {
    for (uint i = 0; i < info.tokens.length; ++i) {
      (, uint256 principalRedeemable) = handler.loan().availableToWithdraw(info.tokens[i]);
      principalWithdrawableAcc += principalRedeemable;
    }
    return principalWithdrawableAcc;
  }

  function principalDepositedReducer(
    uint256 principalDepositedAcc,
    address actor,
    CallableLoanActorInfo memory info
  ) external view returns (uint256) {
    for (uint i = 0; i < info.tokens.length; ++i) {
      principalDepositedAcc += poolTokens.getTokenInfo(info.tokens[i]).principalAmount;
    }
    return principalDepositedAcc;
  }

  function poolTokenPrincipalAmountReducer(
    uint256 principalAmountAcc,
    address actor,
    CallableLoanActorInfo memory info
  ) external view returns (uint256) {
    for (uint i = 0; i < info.tokens.length; ++i) {
      principalAmountAcc += poolTokens.getTokenInfo(info.tokens[i]).principalAmount;
    }
    return principalAmountAcc;
  }
}
