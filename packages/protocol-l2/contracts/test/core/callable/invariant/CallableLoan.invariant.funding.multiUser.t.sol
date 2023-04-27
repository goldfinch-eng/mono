// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {CallableLoanFundingHandler} from "./CallableLoanFundingHandler.t.sol";

contract CallableLoanFundingMultiUserInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanFundingHandler private handler;
  CallableLoan loan;

  function setUp() public virtual override {
    super.setUp();

    (loan, ) = defaultCallableLoan();
    handler = new CallableLoanFundingHandler(
      loan,
      usdc,
      uid,
      poolTokens,
      BORROWER,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);

    bytes4[] memory selectors = new bytes4[](3);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    selectors[2] = handler.warpBeforeInProgress.selector;
    targetSelector(FuzzSelector(address(handler), selectors));
  }

  // PoolTokens TokenInfo invariants

  function invariant_totalPrincipalWithdrawableIsTotalPoolTokenPrincipalAmounts() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    uint256 totalPoolTokenInfoPrincipalAmounts = handler.reduceActors(
      0,
      this.poolTokenPrincipalAmountReducer
    );
    assertEq(totalPrincipalWithdrawable, totalPoolTokenInfoPrincipalAmounts);
  }

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

  // Mostly to debug issues where pool tokens do not match deposits due to test setup issues.
  function assertPoolTokenCountMatchesDeposits() public {
    assertEq(handler.numDeposits(), handler.reduceActors(0, this.numPoolTokensReducer));
  }

  // PoolTokens PoolInfo invariants

  function invariant_PoolTokensPoolInfoTotalMintedIsSumOfPrincipalWithdrawable() public {
    assertEq(
      poolTokens.getPoolInfo(address(handler.loan())).totalMinted,
      handler.reduceActors(0, this.poolTokenPrincipalAmountReducer)
    );
  }

  function invariant_PoolTokensPoolInfoTotalPrincipalRedeemedIsZero() public {
    assertZero(poolTokens.getPoolInfo(address(handler.loan())).totalPrincipalRedeemed);
  }

  // Tranche invariants
  function invariant_UncalledCapitalInfoPrincipalDepositedIsSumOfPrincipalWithdrawable() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalDeposited,
      totalPrincipalWithdrawable
    );
  }

  function invariant_UncalledCapitalInfoPrincipalPaidIsSumOfPrincipalWithdrawable() public {
    uint256 totalPrincipalWithdrawable = handler.reduceActors(0, this.principalWithdrawableReducer);
    assertEq(handler.loan().getUncalledCapitalInfo().principalPaid, totalPrincipalWithdrawable);
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

  // USDC Balances
  function invariant_USDCBalances() public {
    assertEq(usdc.balanceOf(address(loan)), handler.sumDeposited() - handler.sumWithdrawn());
    assertZero(usdc.balanceOf(BORROWER));
  }

  function invariant_LoanPhase() public {
    assertTrue(loan.loanPhase() == LoanPhase.Funding);
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

  function numPoolTokensReducer(
    uint256 numPoolTokensAcc,
    address actor,
    CallableLoanActorInfo memory info
  ) external view returns (uint256) {
    return numPoolTokensAcc + info.tokens.length;
  }
}
