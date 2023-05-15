pragma solidity ^0.8.19;

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {Test} from "forge-std/Test.sol";

contract CallableLoanRandoHandler is Test {
  CallableLoan public loan;

  constructor(CallableLoan _loan) {
    vm.prank(msg.sender);
    loan = _loan;
    vm.stopPrank();
  }

  function drawdown(uint256 amount) public {
    vm.prank(msg.sender);
    loan.drawdown(amount);
    vm.stopPrank();
  }

  function submitCall(uint256 amount, uint256 poolTokenId) public {
    vm.prank(msg.sender);
    loan.submitCall(amount, poolTokenId);
    vm.stopPrank();
  }

  function pay(uint256 amount) public {
    vm.prank(msg.sender);
    loan.pay(amount);
    vm.stopPrank();
  }
}
