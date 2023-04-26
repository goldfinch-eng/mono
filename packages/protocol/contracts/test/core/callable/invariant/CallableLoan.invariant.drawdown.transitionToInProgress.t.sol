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
import {SkipHandler} from "../../../helpers/SkipHandler.t.sol";

contract CallableLoanDrawdownPeriodInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanConstrainedHandler private handler;
  SkipHandler private skipHandler;
  CallableLoan loan;

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
    skipHandler = new SkipHandler();

    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(handler), loan.limit() * 1e18);

    bytes4[] memory selectors = new bytes4[](10);
    selectors[0] = handler.depositTarget.selector;
    selectors[1] = handler.withdrawTarget.selector;
    selectors[2] = handler.warpBeforeInProgressTarget.selector;
    selectors[3] = handler.drawdownTarget.selector;
    selectors[4] = handler.deposit.selector;
    selectors[5] = handler.withdraw.selector;
    selectors[6] = handler.drawdown.selector;
    selectors[7] = handler.skipUpTo7Days.selector;
    selectors[8] = handler.submitCall.selector;
    selectors[9] = handler.pay.selector;

    targetArtifact("UcuProxy");
    targetContract(address(handler));
    targetSelector(FuzzSelector(address(handler), selectors));
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
