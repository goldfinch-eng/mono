// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {CallableLoanHandler} from "./CallableLoanHandler.t.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {IPoolTokens} from "../../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {IBorrower} from "../../../../interfaces/IBorrower.sol";
import {console2 as console} from "forge-std/console2.sol";

/**
 * @title CallableLoanConstrainedHandler
 * @notice CallableLoanConstrainedHandler exposes Callable loan functions with input parameters which
 *         can be constrained to valid inputs.
 *         This is helpful for invariant testing because these function calls are more likely
 *         to be valid calls which will actually modify the state of the loan.
 *         In comparison, the base CallableLoanHandler is unlikely to ever make valid function
 *         calls since it uses uniformly distributed fuzzed parameters.
 */
contract CallableLoanConstrainedHandler is CallableLoanHandler {
  using CallableLoanActorSetLib for CallableLoanActorSet;

  constructor(
    CallableLoan _loan,
    IERC20 _usdc,
    ITestUniqueIdentity0612 _uid,
    IPoolTokens _poolTokens,
    address _borrower,
    uint256 _drawdownPeriod
  ) CallableLoanHandler(_loan, _usdc, _uid, _poolTokens, _borrower, _drawdownPeriod) {}

  // Only warp if the LoanPhase would not transition to InProgress
  function warpBeforeInProgressTarget() public {
    skip(1 days);
    if (loan.loanPhase() == LoanPhase.InProgress) {
      revert();
    }
  }

  /**
   * @param tranche Used for the tranche to deposit into unless useCorrectDepositTranche is true
   */
  function depositTarget(
    uint256 amount,
    uint256 tranche,
    bool boundAmount,
    bool setupActor,
    bool useCorrectDepositTranche
  ) public {
    if (setupActor) {
      setUpActor(msg.sender);
    }
    if (boundAmount) {
      amount = bound(amount, 0, usdc.balanceOf(msg.sender));
    }
    deposit({
      fromActor: msg.sender,
      amount: amount,
      tranche: useCorrectDepositTranche ? loan.uncalledCapitalTrancheIndex() : tranche
    });
  }

  /**
   * @param actorIndex If useExistingDepositor, this is the index of the depositor to use
   * @param poolTokenId If boundPoolTokenId, this is bounded to one of the depositor's pool token to use
   */
  function withdrawTarget(
    uint256 amount,
    uint256 actorIndex,
    uint256 poolTokenId,
    bool boundAmount,
    bool boundPoolTokenId,
    bool useExistingDepositor
  ) public {
    address actor = msg.sender;
    if (useExistingDepositor) {
      // Select a random actor that has already deposited to perform the withdraw
      actorIndex = bound(actorIndex, 0, actorSet.count() - 1);
      address actor = actorSet.actors[actorIndex];
    }

    if (boundPoolTokenId) {
      // Select a random pool token to withdraw from
      uint256 poolTokenId = bound(poolTokenId, 0, actorSet.actorInfo[actor].tokens.length - 1);
    }

    uint256 tokenId = actorSet.actorInfo[actor].tokens[poolTokenId];
    if (boundAmount) {
      (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(tokenId);
      amount = bound(amount, 0, interestRedeemable + principalRedeemable);
    }
    withdraw({fromActor: actor, amount: amount, tokenId: tokenId});
  }

  function drawdownTarget(uint256 amount, bool boundAmount, bool drawdownFromBorrower) public {
    uint256 principalPaidBeforeDrawdown = ICreditLine(address(loan)).totalPrincipalPaid();
    address fromActor = drawdownFromBorrower ? borrower : currentActor;
    if (boundAmount) {
      amount = bound(amount, 0, principalPaidBeforeDrawdown);
    }
    drawdown({fromActor: fromActor, amount: amount});
  }

  /**
   * @param boundAmount There is no realistic limit to the amount that can be repaid, since any excess is refunded.
   *                    If we bound the amount, we bound it to values below the remaining balance.
   */
  function payTarget(
    uint256 amount,
    bool boundAmount,
    bool fundPayer,
    bool approveFromPayer
  ) public {
    if (boundAmount) {
      amount = bound(amount, 0, loan.balance() + loan.interestOwed());
    }

    if (fundPayer) {
      usdc.transfer(msg.sender, amount);
    }

    if (approveFromPayer) {
      _startImpersonation(msg.sender);
      usdc.approve(address(loan), amount);
      _stopImpersonation();
    }

    pay({fromActor: msg.sender, amount: amount});
  }

  function submitCallTarget(
    uint256 amount,
    uint256 actorIndex,
    uint256 poolTokenId,
    bool useExistingDepositor,
    bool boundAmount,
    bool boundPoolTokenId
  ) public {
    address actor = msg.sender;
    if (useExistingDepositor) {
      // Select a random actor that has already deposited to perform the withdraw
      actorIndex = bound(actorIndex, 0, actorSet.count() - 1);
      address actor = actorSet.actors[actorIndex];
    }

    if (boundPoolTokenId) {
      // Select a random pool token to withdraw from
      uint256 poolTokenId = bound(poolTokenId, 0, actorSet.actorInfo[actor].tokens.length - 1);
    }

    uint256 tokenId = actorSet.actorInfo[actor].tokens[poolTokenId];
    if (boundAmount) {
      amount = bound(amount, 0, poolTokens.getTokenInfo(tokenId).principalAmount);
    }

    poolTokenId = bound(poolTokenId, 0, actorSet.actorInfo[currentActor].tokens.length - 1);
    submitCall({fromActor: actor, amount: amount, poolTokenId: poolTokenId});
  }
}
