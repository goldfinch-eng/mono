// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {BaseTest} from "../../BaseTest.t.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {UtilityHandler} from "../../../helpers/UtilityHandler.t.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {LoanPhase, ICallableLoan} from "../../../../interfaces/ICallableLoan.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {IPoolTokens} from "../../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {IBorrower} from "../../../../interfaces/IBorrower.sol";
import {console2 as console} from "forge-std/console2.sol";

/**
 * @title CallableLoanHandler
 * @notice CallableLoanHandler exposes Callable loan functions which keep track of the state of the loan
 *         via various public "ghost" variables. This is useful for testing invariants.
 */
contract CallableLoanHandler is BaseTest, UtilityHandler {
  struct RedeemableSnapshot {
    uint256 interestRedeemable;
    uint256 principalRedeemable;
  }


  using CallableLoanActorSetLib for CallableLoanActorSet;

  IERC20 internal usdc;
  ITestUniqueIdentity0612 internal uid;
  IPoolTokens internal poolTokens;
  CallableLoanActorSet internal actorSet;
  address internal currentActor;
  address internal borrower;
  uint256 internal drawdownPeriod;

  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;
  uint256 public sumDrawndown;
  uint256 public sumInterestPaid; // According to CallableLoan#pay return
  uint256 public sumPrincipalPaid; // According to CallableLoan#pay return
  uint256 public numDeposits;
  bool public hasDrawndown = false;
  mapping(uint256 => IPoolTokens.TokenInfo) public poolTokensAtTimeOfFirstDrawdown;

  
  mapping(uint256 => RedeemableSnapshot) public poolTokensePreSubmitCallSnapshot;
  mapping(uint256 => RedeemableSnapshot) public poolTokensePostSubmitCallSnapshot;
  uint256 public lastBurnedCalledPoolTokenId;
  uint256 public lastRemainingPoolTokenId;
  uint256 public lastCalledPoolTokenId;

  uint256 public callableLoanBalanceBeforeFirstDrawdown;  
  uint256 public borrowerBalanceBeforeFirstDrawdown;

  constructor(CallableLoan _loan, IERC20 _usdc, ITestUniqueIdentity0612 _uid, IPoolTokens _poolTokens, address _borrower, uint256 _drawdownPeriod) {
    loan = _loan;
    usdc = _usdc;
    uid = _uid;
    borrower = _borrower;
    drawdownPeriod = _drawdownPeriod;
    poolTokens = _poolTokens;
  }

  function deposit(address fromActor, uint256 amount, uint256 tranche) public {
    _startImpersonation(fromActor);
    uint256 tokenId = loan.deposit({tranche: tranche, amount: amount});
    sumDeposited += amount;
    actorSet.actorInfo[fromActor].tokens.push(tokenId);
    _stopImpersonation();
  }

  function withdraw(
    address fromActor,
    uint256 amount,
    uint256 tokenId
  ) public {
    _startImpersonation(fromActor);
    loan.withdraw(tokenId, amount);
    sumWithdrawn += amount;
    _stopImpersonation();
  }

  function drawdown(
    address fromActor,
    uint256 amount
  ) public {
    _startImpersonation(fromActor);

    if(!hasDrawndown) {
      actorSet.forEach(this.snapshotPoolTokensAtFirstDrawdown);
      callableLoanBalanceBeforeFirstDrawdown = usdc.balanceOf(address(loan));
      borrowerBalanceBeforeFirstDrawdown = usdc.balanceOf(borrower);
    }

    loan.drawdown(amount);
    sumDrawndown += amount;
    hasDrawndown = true;

    _stopImpersonation();
  }
  
  function submitCall(
    address fromActor,
    uint256 amount,
    uint256 poolTokenId
  ) public {    
    _startImpersonation(fromActor);
      actorSet.forEach(this.snapshotPreSubmitCallPoolTokens);
    (uint256 interestToWithdraw, uint256 principalToWithdraw) = loan.availableToWithdraw(poolTokenId);
    sumWithdrawn += interestToWithdraw + principalToWithdraw;
    lastBurnedCalledPoolTokenId = poolTokenId;
    (lastRemainingPoolTokenId, lastCalledPoolTokenId) = loan.submitCall({
      callAmount: amount,
      poolTokenId: poolTokenId
    });

    actorSet.actorInfo[currentActor].tokens.push(lastCalledPoolTokenId);
    actorSet.actorInfo[currentActor].tokens.push(lastRemainingPoolTokenId);

    actorSet.forEach(this.snapshotPostSubmitCallPoolTokens);
    _stopImpersonation();
  }

  function pay(
    address fromActor,
    uint256 amount
  ) public {    
    _startImpersonation(fromActor);
    ICallableLoan.PaymentAllocation memory pa = loan.pay(amount);
    sumInterestPaid += pa.owedInterestPayment + pa.accruedInterestPayment;
    sumPrincipalPaid += pa.principalPayment + pa.additionalBalancePayment;
    _stopImpersonation();
  }

  function snapshotPoolTokensAtFirstDrawdown(address actor, CallableLoanActorInfo memory actorInfo) public {
    for(uint256 i = 0; i < actorInfo.tokens.length; i++) {
      IPoolTokens.TokenInfo memory a = poolTokens.getTokenInfo(actorInfo.tokens[i]);
      poolTokensAtTimeOfFirstDrawdown[actorInfo.tokens[i]] = poolTokens.getTokenInfo(actorInfo.tokens[i]);
    }
  }

  function snapshotPreSubmitCallPoolTokens(address actor, CallableLoanActorInfo memory actorInfo) public {
    for(uint256 i = 0; i < actorInfo.tokens.length; i++) {
      (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(actorInfo.tokens[i]);
      poolTokensePreSubmitCallSnapshot[actorInfo.tokens[i]] = RedeemableSnapshot({
        interestRedeemable: interestRedeemable,
        principalRedeemable: principalRedeemable
      });
    }
  }

  function snapshotPostSubmitCallPoolTokens(address actor, CallableLoanActorInfo memory actorInfo) public {
    for(uint256 i = 0; i < actorInfo.tokens.length; i++) {
      (uint256 interestRedeemable, uint256 principalRedeemable) = loan.availableToWithdraw(actorInfo.tokens[i]);
      poolTokensePostSubmitCallSnapshot[actorInfo.tokens[i]] = RedeemableSnapshot({
        interestRedeemable: interestRedeemable,
        principalRedeemable: principalRedeemable
      });
    }
  }

  /// @notice Reduce across the active actors
  function reduceActors(
    uint256 acc,
    function(uint256 acc, address actor, CallableLoanActorInfo memory info) external returns (uint256) func
  ) public returns (uint256) {
    return actorSet.reduce(acc, func);
  }

  /// @notice Run a function on every active actor
  function forEachActor(
    function(address actor, CallableLoanActorInfo memory info) external fn
  ) public {
    return actorSet.forEach(fn);
  }

  function setUpActor(address actor) public {
    uid._mintForTest(actor, 1, 1, "");
    usdc.transfer(actor, loan.limit());
    _startImpersonation(actor);
    usdc.approve(address(loan), type(uint256).max);
    actorSet.add(actor);
    _stopImpersonation();
  }
}