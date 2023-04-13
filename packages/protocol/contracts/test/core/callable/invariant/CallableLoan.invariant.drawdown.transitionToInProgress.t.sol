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
import {CallableLoanFundingHandler} from "./CallableLoanFundingHandler.t.sol";
import {CallableLoanRandoHandler} from "./CallableLoanRandoHandler.t.sol";
import {InvariantSkipTarget} from "../../../helpers/InvariantSkipTarget.t.sol";

contract CallableLoanDrawdownPeriodInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanFundingHandler private handler;
  CallableLoanRandoHandler private randoHandler;
  InvariantSkipTarget private invariantSkipTarget;
  CallableLoan loan;

  function setUp() public override {
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
    randoHandler = new CallableLoanRandoHandler(loan);
    invariantSkipTarget = new InvariantSkipTarget();

    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);
    fundAddress(address(randoHandler), loan.limit() * 1e18);

    bytes4[] memory selectors = new bytes4[](4);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    selectors[2] = handler.warpBeforeInProgress.selector;
    selectors[3] = handler.drawdown.selector;

    bytes4[] memory randomSelectors = new bytes4[](3);
    randomSelectors[0] = randoHandler.drawdown.selector;
    randomSelectors[1] = randoHandler.submitCall.selector;
    randomSelectors[2] = randoHandler.pay.selector;

    bytes4[] memory warpSelectors = new bytes4[](1);
    warpSelectors[0] = InvariantSkipTarget.skipUpToSevenDays.selector;

    targetArtifact("UcuProxy");
    targetSelector(FuzzSelector(address(handler), selectors));
    targetSelector(FuzzSelector(address(randoHandler), randomSelectors));
    targetSelector(FuzzSelector(address(invariantSkipTarget), warpSelectors));
  }

  function invariant_ExpectedPhase() public {
    if (!handler.hasDrawndown()) {
      assertTrue(handler.loan().loanPhase() == LoanPhase.Funding);
    } else if (block.timestamp < loan.termStartTime() + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS) {
      assertTrue(handler.loan().loanPhase() == LoanPhase.DrawdownPeriod);
    } else {
      assertTrue(handler.loan().loanPhase() == LoanPhase.InProgress);
    }
  }
}
