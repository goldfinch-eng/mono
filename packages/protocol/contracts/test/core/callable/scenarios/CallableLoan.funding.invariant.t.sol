// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";

// import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanHandler is Test {
  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;
  uint256[] public poolTokens;

  constructor(CallableLoan _loan, IERC20 usdc) public {
    // vm = _vm;
    loan = _loan;
    usdc.approve(address(_loan), type(uint256).max);
  }

  function deposit(uint256 amount) public {
    uint256 maxDepositableAmount = loan.limit() - sumDeposited;

    if (maxDepositableAmount == 0) {
      return;
    }

    amount = bound(amount, 1, maxDepositableAmount);

    uint256 token = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);

    sumDeposited += amount;
    poolTokens.push(token);
  }

  function withdraw(uint256 tokenIndex, uint256 amount) public {
    if (poolTokens.length == 0) {
      // There aren't any deposits - return!
      return;
    }

    tokenIndex = bound(tokenIndex, 0, poolTokens.length - 1);
    uint256 token = poolTokens[tokenIndex];
    (, uint256 principalRedeemable) = loan.availableToWithdraw(token);

    if (principalRedeemable == 0) {
      // Pool token already fully withdrawn - return!
      return;
    }

    amount = bound(amount, 1, principalRedeemable);

    loan.withdraw(token, amount);

    sumWithdrawn += amount;
  }

  // So we can mint UIDs to the test class
  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return 0xf23a6e61;
  }
}

contract CallableLoanFundingInvariantTest is CallableLoanBaseTest, InvariantTest {
  CallableLoanHandler internal handler;
  uint256 private handlerOriginalUsdcBalance;

  function setUp() public override {
    super.setUp();
    (CallableLoan loan, ) = defaultCallableLoan();

    handler = new CallableLoanHandler(loan, usdc);
    uid._mintForTest(address(handler), 1, 1, "");

    fundAddress(address(handler), loan.limit());
    handlerOriginalUsdcBalance = usdc.balanceOf(address(handler));

    // Manually override all the target contracts to be just the handler. We don't want any of the
    // contracts created in super's setUp to be called
    bytes4[] memory selectors = new bytes4[](2);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    targetContract(address(handler));
    targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
  }

  function invariantBalanceOfPoolIsDepositsLessWithdrawals() public {
    assertEq(
      usdc.balanceOf(address(handler.loan())),
      handler.sumDeposited() - handler.sumWithdrawn()
    );
  }

  function invariantBalanceOfDepositorIsOriginalBalanceLessDepositsPlusWithdrawals() public {
    assertEq(
      usdc.balanceOf(address(handler)),
      handlerOriginalUsdcBalance - handler.sumDeposited() + handler.sumWithdrawn()
    );
  }

  function invariantUncalledCapitalInfoPrincipalDepositedIsDepositsLessWithdrawals() public {
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalDeposited,
      handler.sumDeposited() - handler.sumWithdrawn()
    );
  }

  function invariantUncalledCapitalInfoPrincipalPaidIsZero() public {
    // Should this be 0?
    assertZero(handler.loan().getUncalledCapitalInfo().principalPaid);
  }
}
