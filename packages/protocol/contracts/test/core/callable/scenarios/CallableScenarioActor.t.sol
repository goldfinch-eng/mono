// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable reentrancy
// solhint-disable contract-name-camelcase

pragma solidity ^0.8.0;

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {ICallableLoan, LoanPhase} from "../../../../interfaces/ICallableLoan.sol";
import {ITestUSDC} from "../../../ITestUSDC.t.sol";
import {Test} from "forge-std/Test.sol";

/**
 * Actor in a Callable loan scenario. Will either be a Lender or a Borrower and
 * can be trusted to complain if they end up with unexpected balances.
 */
abstract contract CallableScenarioActor is Test {
  ICallableLoan internal loan;
  ITestUSDC internal usdc;

  constructor(ICallableLoan _loan, ITestUSDC _usdc) {
    loan = _loan;
    usdc = _usdc;
  }

  function setLoan(ICallableLoan _loan) external {
    loan = _loan;
  }

  function setUSDC(ITestUSDC _usdc) external {
    usdc = _usdc;
  }

  modifier expectUsdcIncrease(uint256 amount) {
    uint256 balanceBefore = usdc.balanceOf(address(this));

    _;

    uint256 balanceAfter = usdc.balanceOf(address(this));
    assertEq(balanceBefore + amount, balanceAfter, "usdc increase");
  }

  modifier expectUsdcDecrease(uint256 amount) {
    uint256 balanceBefore = usdc.balanceOf(address(this));

    _;

    uint256 balanceAfter = usdc.balanceOf(address(this));
    assertEq(balanceAfter + amount, balanceBefore, "usdc decrease");
  }
}

contract CallableBorrower is CallableScenarioActor {
  constructor(ITestUSDC _usdc) CallableScenarioActor(ICallableLoan(address(uint160(0))), _usdc) {}

  function pay(uint256 amount) external expectUsdcDecrease(amount) {
    usdc.approve(address(loan), amount);
    loan.pay(amount);
  }

  function drawdown(uint256 amount) external expectUsdcIncrease(amount) {
    loan.drawdown(amount);
  }
}

contract CallableLender is CallableScenarioActor {
  uint256[] public tokenIds;
  uint256[] public calledTokenIds;
  uint256[] public uncalledTokenIds;

  constructor(ICallableLoan _loan, ITestUSDC _usdc) CallableScenarioActor(_loan, _usdc) {}

  function tokenIdsLength() external view returns (uint256) {
    return tokenIds.length;
  }

  function calledTokenIdsLength() external view returns (uint256) {
    return calledTokenIds.length;
  }

  function uncalledTokenIdsLength() external view returns (uint256) {
    return uncalledTokenIds.length;
  }

  function submitCall(uint256 amount, uint256 tokenId) external {
    uint256 balanceBefore = usdc.balanceOf(address(this));
    (uint256 availablePrincipal, uint256 availableInterest) = loan.availableToWithdraw(tokenId);
    (uint256 _callRequestTokenId, uint256 _tokenId) = loan.submitCall(amount, tokenId);
    assertEq(
      balanceBefore + availablePrincipal + availableInterest,
      usdc.balanceOf(address(this)),
      "usdc increase"
    );
    tokenIds.push(_callRequestTokenId);
    tokenIds.push(_tokenId);

    calledTokenIds.push(_callRequestTokenId);
    uncalledTokenIds.push(_tokenId);
  }

  function deposit(uint256 amount) external expectUsdcDecrease(amount) {
    usdc.approve(address(loan), amount);
    uint256 tokenId = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);
    tokenIds.push(tokenId);
    uncalledTokenIds.push(tokenId);
  }

  function availableToWithdraw(
    uint256 tokenId
  ) external view returns (uint256 availableInterest, uint256 availablePrincipal) {
    return loan.availableToWithdraw(tokenId);
  }

  function withdraw(uint256 amount, uint256 tokenId) external expectUsdcIncrease(amount) {
    loan.withdraw(tokenId, amount);
  }

  function withdrawMax(uint256 tokenId) external {
    loan.withdrawMax(tokenId);
  }
}
