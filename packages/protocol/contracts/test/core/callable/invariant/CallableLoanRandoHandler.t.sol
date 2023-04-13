import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {Test} from "forge-std/Test.sol";

// Attempt invalid operations from random users
contract CallableLoanRandoHandler is Test {
  CallableLoan public loan;

  constructor(CallableLoan _loan) {
    vm.prank(msg.sender);
    loan = _loan;
    vm.stopPrank();
  }

  // Attempt an invalid drawdown from a random user
  function drawdown(uint256 amount) public {
    vm.assume(msg.sender != loan.borrower());
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
