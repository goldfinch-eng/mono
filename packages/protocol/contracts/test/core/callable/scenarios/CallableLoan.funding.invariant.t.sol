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
  struct TokenInfo {
    uint256 tokenId;
    uint256 originalDeposited;
    uint256 withdrawn;
  }

  CallableLoan public loan;
  uint256 public sumDeposited;
  uint256 public sumWithdrawn;
  TokenInfo[] public poolTokens;
  uint256 public indexOfLastTokenInteractedWith = type(uint256).max;

  constructor(CallableLoan _loan, IERC20 usdc) public {
    // vm = _vm;
    loan = _loan;
    usdc.approve(address(_loan), type(uint256).max);
  }

  function deposit(uint256 amount) public {
    uint256 totalPrincipalDeposited = sumDeposited - sumWithdrawn;
    uint256 maxDepositableAmount = loan.limit() - totalPrincipalDeposited;

    if (maxDepositableAmount == 0) {
      return;
    }

    amount = bound(amount, 1, maxDepositableAmount);

    uint256 token = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);

    indexOfLastTokenInteractedWith = poolTokens.length;
    sumDeposited += amount;
    poolTokens.push(TokenInfo({tokenId: token, originalDeposited: amount, withdrawn: 0}));
  }

  function withdraw(uint256 tokenIndex, uint256 amount) public {
    if (poolTokens.length == 0) {
      // There aren't any deposits - return!
      return;
    }

    tokenIndex = bound(tokenIndex, 0, poolTokens.length - 1);
    TokenInfo storage tokenInfo = poolTokens[tokenIndex];
    (, uint256 principalRedeemable) = loan.availableToWithdraw(tokenInfo.tokenId);

    if (principalRedeemable == 0) {
      // Pool token already fully withdrawn - return!
      return;
    }

    amount = bound(amount, 1, principalRedeemable);

    loan.withdraw(tokenInfo.tokenId, amount);

    sumWithdrawn += amount;
    tokenInfo.withdrawn += amount;
    indexOfLastTokenInteractedWith = tokenIndex;
  }

  function getTokenInfoByIndex(uint256 i) public view returns (TokenInfo memory) {
    return poolTokens[i];
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

  /// USDC balance invariants

  function invariant_BalanceOfPoolIsDepositsLessWithdrawals() public {
    assertEq(
      usdc.balanceOf(address(handler.loan())),
      handler.sumDeposited() - handler.sumWithdrawn()
    );
  }

  function invariant_BalanceOfDepositorIsOriginalBalanceLessDepositsPlusWithdrawals() public {
    assertEq(
      usdc.balanceOf(address(handler)),
      handlerOriginalUsdcBalance - (handler.sumDeposited() - handler.sumWithdrawn())
    );
  }

  /// UncalledCapitalInfo invariants

  function invariant_UncalledCapitalInfoPrincipalDepositedIsDepositsLessWithdrawals() public {
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalDeposited,
      handler.sumDeposited() - handler.sumWithdrawn()
    );
  }

  function invariant_UncalledCapitalInfoPrincipalPaidIsZero() public {
    assertEq(
      handler.loan().getUncalledCapitalInfo().principalPaid,
      handler.sumDeposited() - handler.sumWithdrawn()
    );
  }

  function invariant_UncalledCapitalInfoPrincipalReservedIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().principalReserved);
  }

  function invariant_UncalledCapitalInfoInterestPaidIsZero() public {
    assertZero(handler.loan().getUncalledCapitalInfo().interestPaid);
  }

  /// PoolTokenInfo invariants

  function invariant_TokenInfoTrancheIsUncalledCapitalTranche() public {
    uint256 tokenIndex = handler.indexOfLastTokenInteractedWith();
    if (tokenIndex == type(uint256).max) {
      // Early return if there have been no deposits yet
      return;
    }

    assertEq(
      poolTokens.getTokenInfo(handler.getTokenInfoByIndex(tokenIndex).tokenId).tranche,
      handler.loan().uncalledCapitalTrancheIndex()
    );
  }

  function invariant_TokenInfoPoolIsCallableLoan() public {
    uint256 tokenIndex = handler.indexOfLastTokenInteractedWith();
    if (tokenIndex == type(uint256).max) {
      // Early return if there have been no deposits yet
      return;
    }

    assertEq(
      poolTokens.getTokenInfo(handler.getTokenInfoByIndex(tokenIndex).tokenId).pool,
      address(handler.loan())
    );
  }

  function invariant_TokenInfoPrincipalAmountIsAmountDeposited() public {
    uint256 tokenIndex = handler.indexOfLastTokenInteractedWith();
    if (tokenIndex == type(uint256).max) {
      // Early return if there have been no deposits yet
      return;
    }

    assertEq(
      poolTokens.getTokenInfo(handler.getTokenInfoByIndex(tokenIndex).tokenId).principalAmount,
      handler.getTokenInfoByIndex(tokenIndex).originalDeposited -
        handler.getTokenInfoByIndex(tokenIndex).withdrawn
    );
  }

  function invariant_TokenInfoPrincipalRedeemedIsZero() public {
    uint256 tokenIndex = handler.indexOfLastTokenInteractedWith();
    if (tokenIndex == type(uint256).max) {
      // Early return if there have been no deposits yet
      return;
    }

    assertZero(
      poolTokens.getTokenInfo(handler.getTokenInfoByIndex(tokenIndex).tokenId).principalRedeemed
    );
  }

  function invariant_TokenInfoInterestRedeemedIsZero() public {
    uint256 tokenIndex = handler.indexOfLastTokenInteractedWith();
    if (tokenIndex == type(uint256).max) {
      // Early return if there have been no deposits yet
      return;
    }

    assertZero(
      poolTokens.getTokenInfo(handler.getTokenInfoByIndex(tokenIndex).tokenId).interestRedeemed
    );
  }
}
