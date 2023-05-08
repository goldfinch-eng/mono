// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {CallableLoanFundingHandler} from "./CallableLoanFundingHandler.t.sol";
import {CallableLoanRandoHandler} from "./CallableLoanRandoHandler.t.sol";
import {CallableLoanFundingMultiUserInvariantTest} from "./CallableLoan.invariant.funding.multiUser.t.sol";

contract CallableLoanFundingMultiUserRandoSelectorsInvariantTest is
  CallableLoanFundingMultiUserInvariantTest
{
  CallableLoanFundingHandler private handler;
  CallableLoanRandoHandler private randoHandler;

  function setUp() public override {
    super.setUp();

    randoHandler = new CallableLoanRandoHandler(loan);

    // Add enough USDC to the handler that it can fund each depositor up to the loan limit
    fundAddress(address(randoHandler), loan.limit() * 1e18);

    bytes4[] memory randomSelectors = new bytes4[](3);
    randomSelectors[0] = randoHandler.drawdown.selector;
    randomSelectors[1] = randoHandler.submitCall.selector;
    randomSelectors[2] = randoHandler.pay.selector;

    targetArtifact("UcuProxy");
    targetSelector(FuzzSelector(address(randoHandler), randomSelectors));
  }
}
