// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CallableLoanActorInfo, CallableLoanActorSet, CallableLoanActorSetLib} from "./CallableLoanActor.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";
import {LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {ITestUniqueIdentity0612} from "../../../ITestUniqueIdentity0612.t.sol";
import {IPoolTokens} from "../../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {IBorrower} from "../../../../interfaces/IBorrower.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanFundingHandler is Test {
  using CallableLoanActorSetLib for CallableLoanActorSet;

  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;
  uint256 public sumDrawndown;
  uint256 public numDeposits;
  IERC20 private usdc;
  ITestUniqueIdentity0612 private uid;
  IPoolTokens private poolTokens;
  CallableLoanActorSet private actorSet;
  address private currentActor;
  address borrower;
  uint256 drawdownPeriod;
  bool public hasDrawndown = false;
  mapping(uint256 => IPoolTokens.TokenInfo) public poolTokensAtTimeOfFirstDrawdown;

  uint256 public callableLoanBalanceBeforeFirstDrawdown;  
  uint256 public borrowerBalanceBeforeFirstDrawdown;

  constructor(CallableLoan _loan, IERC20 _usdc, ITestUniqueIdentity0612 _uid, IPoolTokens _poolTokens, address _borrower, uint256 _drawdownPeriod) {
    loan = _loan;
    usdc = _usdc;
    uid = _uid;
    borrower = _borrower;
    drawdownPeriod = _drawdownPeriod;
  }

  // Only warp if the LoanPhase would not transition to InProgress
  function warpBeforeInProgress() public {
    skip(1 days);
    if(loan.loanPhase() == LoanPhase.InProgress) {
      revert();
    }
  }

  function deposit(uint256 amount) public createActor {
    vm.startPrank(currentActor);
    uint256 tokenId = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);
    vm.stopPrank();

    sumDeposited += amount;
    actorSet.actorInfo[currentActor].tokens.push(tokenId);
  }

  function withdraw(
    uint256 amount,
    uint256 actorIndex,
    uint256 poolTokenIndex,
    bool forceValidWithdraw
  ) public createActor {
      // Select a random actor that has already deposited to perform the withdraw
      actorIndex = bound(actorIndex, 0, actorSet.count() - 1);
      address actor = actorSet.actors[actorIndex];

      // Select a random pool token to withdraw from
      uint256 poolTokenIndex = bound(
        poolTokenIndex,
        0,
        actorSet.actorInfo[actor].tokens.length - 1
      );
      uint256 tokenId = actorSet.actorInfo[actor].tokens[poolTokenIndex];
    if(forceValidWithdraw) {
      amount = bound(amount, 0, poolTokens.getTokenInfo(tokenId).principalAmount);
    }
    vm.startPrank(currentActor);
    loan.withdraw(tokenId, amount);
    vm.stopPrank();

    sumWithdrawn += amount;
  }

  function drawdown(
    uint256 amount,
    bool drawdownFromBorrower
  ) public createActor {
    uint256 principalPaidBeforeDrawdown = ICreditLine(address(loan)).totalPrincipalPaid();

    if(drawdownFromBorrower) {
      vm.startPrank(borrower); 
    } else {
      vm.startPrank(currentActor);
    }

    bool isValidDrawdown = amount <= principalPaidBeforeDrawdown && drawdownFromBorrower;
    
    // Should only occur on first drawdown
    if(!hasDrawndown && isValidDrawdown) {
      actorSet.forEach(this.snapshotPoolTokens);
      callableLoanBalanceBeforeFirstDrawdown = usdc.balanceOf(address(loan));
      borrowerBalanceBeforeFirstDrawdown = usdc.balanceOf(borrower);
    }
    loan.drawdown(amount);
    vm.stopPrank();

    sumDrawndown += amount;
    hasDrawndown = true;
  }

  function snapshotPoolTokens(address actor, CallableLoanActorInfo memory actorInfo) public {
    for(uint256 i = 0; i < actorInfo.tokens.length; i++) {
      poolTokensAtTimeOfFirstDrawdown[actorInfo.tokens[i]] = poolTokens.getTokenInfo(actorInfo.tokens[i]);
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

  function setUpActor(address actor) private {
    uid._mintForTest(msg.sender, 1, 1, "");
    usdc.transfer(msg.sender, loan.limit());
    vm.prank(msg.sender);
    usdc.approve(address(loan), type(uint256).max);
    actorSet.add(msg.sender);
  }

  modifier createActor {
    // If this is the first time we're seeing this actor then apply set up to it
    if (!actorSet.contains(msg.sender))
      setUpActor(msg.sender);

    currentActor = msg.sender;
    _;
  }
}