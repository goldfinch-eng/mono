// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {IERC20} from "../../../../interfaces/IERC20.sol";

contract CallableLoanHandler is Test {
  struct TokenInfo {
    uint256 tokenId;
    // Set once, upon deposit
    uint256 originalDeposited;
    // Increased every time the token is randomly selected for withdrawals
    uint256 withdrawn;
  }

  /// @notice The contract under test
  CallableLoan public loan;

  /// @notice Nondecreasing total amount deposited by the handler after the most recent call
  uint256 public sumDeposited;

  /// @notice Nondecreasing total amount withdrawn by the handler after the most recent call
  uint256 public sumWithdrawn;

  /// @notice All of the handler's pool tokens, including fully redeemed ones
  TokenInfo[] public poolTokens;

  /// @notice Tokens involved in the last deposit, withdraw, or withdrawMultiple call. It SHOULD
  ///   NOT persist across those calls. Persisting across other calls like `warp` is good
  TokenInfo[] private poolTokensFromLastCall;

  constructor(CallableLoan _loan, IERC20 usdc) public {
    loan = _loan;
    usdc.approve(address(_loan), type(uint256).max);
  }

  function warp() public {
    skip(1 days);
  }

  function deposit(uint256 amount) public clearCallState {
    uint256 totalPrincipalDeposited = sumDeposited - sumWithdrawn;
    uint256 maxDepositableAmount = loan.limit() - totalPrincipalDeposited;

    if (maxDepositableAmount == 0) {
      // Token already fully withrawn - return!
      return;
    }

    amount = bound(amount, 1, maxDepositableAmount);

    uint256 token = loan.deposit(loan.uncalledCapitalTrancheIndex(), amount);

    sumDeposited += amount;
    TokenInfo memory tokenInfo = TokenInfo({
      tokenId: token,
      originalDeposited: amount,
      withdrawn: 0
    });
    poolTokens.push(tokenInfo);
    poolTokensFromLastCall.push(tokenInfo);
  }

  function withdraw(uint256 tokenIndex, uint256 amount) public clearCallState {
    if (poolTokens.length == 0) {
      // There aren't any deposits yet - return!
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
    poolTokensFromLastCall.push(tokenInfo);
  }

  function withdrawMultiple(uint256 tokenIndexStart, uint256 tokenIndexEnd) public clearCallState {
    if (poolTokens.length == 0) {
      // There aren't any deposits yet - return!
      return;
    }

    // Select a random range of pool tokens to withdraw from
    tokenIndexStart = bound(tokenIndexStart, 0, poolTokens.length - 1);
    tokenIndexEnd = bound(tokenIndexEnd, tokenIndexStart, poolTokens.length - 1);

    // For all the pool tokens over the range choose an amount in [1, principalRedeemable]
    // to withdraw. The number of pool tokens we withdraw on could be less than the number of
    // pool tokens in the range if a token's principalRedeemable is 0
    uint256 withdrawalAmount = 0;
    uint256 totalWithdrawalAmount = 0;
    uint256[] memory withdrawalAmounts = new uint256[](tokenIndexEnd - tokenIndexStart + 1);
    uint256 withdrawalAmountIndex = 0;
    for (uint256 i = tokenIndexStart; i <= tokenIndexEnd; ++i) {
      TokenInfo storage tokenInfo = poolTokens[i];
      (, uint256 principalRedeemable) = loan.availableToWithdraw(tokenInfo.tokenId);
      if (principalRedeemable > 0) {
        withdrawalAmount = bound(withdrawalAmount, 1, principalRedeemable);
        tokenInfo.withdrawn += withdrawalAmount;
        totalWithdrawalAmount += withdrawalAmount;
        poolTokensFromLastCall.push(tokenInfo);
        withdrawalAmounts[withdrawalAmountIndex] = withdrawalAmount;
        withdrawalAmountIndex++;
      }
    }

    sumWithdrawn += totalWithdrawalAmount;

    // Now that we have withdrawal amounts for all the pool tokens in the range with non-zero
    // principalRedeemable, We can make the call to withdrawMultiple
    uint256[] memory tokenIdsForWithdrawMultiple = new uint256[](poolTokensFromLastCall.length);
    uint256[] memory withdrawalAmountsForWithdrawMultiple = new uint256[](
      poolTokensFromLastCall.length
    );
    for (uint256 i = 0; i < poolTokensFromLastCall.length; ++i) {
      tokenIdsForWithdrawMultiple[i] = poolTokensFromLastCall[i].tokenId;
      withdrawalAmountsForWithdrawMultiple[i] = withdrawalAmounts[i];
    }
    loan.withdrawMultiple(tokenIdsForWithdrawMultiple, withdrawalAmountsForWithdrawMultiple);
  }

  function getPoolTokensFromLastCall() external view returns (TokenInfo[] memory) {
    return poolTokensFromLastCall;
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

  /// @notice Clear state that doesn't persist across calls
  modifier clearCallState() {
    delete poolTokensFromLastCall;
    _;
  }
}

contract CallableLoanFundingSingleUserInvariantTest is CallableLoanBaseTest, InvariantTest {
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
    bytes4[] memory selectors = new bytes4[](4);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    selectors[2] = handler.warp.selector;
    selectors[3] = handler.withdrawMultiple.selector;
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
    CallableLoanHandler.TokenInfo[] memory poolTokensFromLastInteraction = handler
      .getPoolTokensFromLastCall();
    if (poolTokensFromLastInteraction.length == 0) {
      // There haven't been any deposits - early return!
      return;
    }

    for (uint i = 0; i < poolTokensFromLastInteraction.length; ++i) {
      assertEq(
        poolTokens.getTokenInfo(poolTokensFromLastInteraction[i].tokenId).tranche,
        handler.loan().uncalledCapitalTrancheIndex()
      );
    }
  }

  function invariant_TokenInfoPoolIsCallableLoan() public {
    CallableLoanHandler.TokenInfo[] memory poolTokensFromLastInteraction = handler
      .getPoolTokensFromLastCall();
    if (poolTokensFromLastInteraction.length == 0) {
      // There haven't been any deposits - early return!
      return;
    }

    for (uint i = 0; i < poolTokensFromLastInteraction.length; ++i) {
      assertEq(
        poolTokens.getTokenInfo(poolTokensFromLastInteraction[i].tokenId).pool,
        address(handler.loan())
      );
    }
  }

  function invariant_TokenInfoPrincipalAmountIsAmountDeposited() public {
    CallableLoanHandler.TokenInfo[] memory poolTokensFromLastInteraction = handler
      .getPoolTokensFromLastCall();
    if (poolTokensFromLastInteraction.length == 0) {
      // There haven't been any deposits - early return!
      return;
    }

    for (uint i = 0; i < poolTokensFromLastInteraction.length; ++i) {
      assertEq(
        poolTokens.getTokenInfo(poolTokensFromLastInteraction[i].tokenId).principalAmount,
        poolTokensFromLastInteraction[i].originalDeposited -
          poolTokensFromLastInteraction[i].withdrawn
      );
    }
  }

  function invariant_TokenInfoPrincipalRedeemedIsZero() public {
    CallableLoanHandler.TokenInfo[] memory poolTokensFromLastInteraction = handler
      .getPoolTokensFromLastCall();
    if (poolTokensFromLastInteraction.length == 0) {
      // There haven't been any deposits - early return!
      return;
    }

    for (uint i = 0; i < poolTokensFromLastInteraction.length; ++i) {
      assertZero(
        poolTokens.getTokenInfo(poolTokensFromLastInteraction[i].tokenId).principalRedeemed
      );
    }
  }

  function invariant_TokenInfoInterestRedeemedIsZero() public {
    CallableLoanHandler.TokenInfo[] memory poolTokensFromLastInteraction = handler
      .getPoolTokensFromLastCall();
    if (poolTokensFromLastInteraction.length == 0) {
      // There haven't been any deposits - early return!
      return;
    }

    for (uint i = 0; i < poolTokensFromLastInteraction.length; ++i) {
      assertZero(
        poolTokens.getTokenInfo(poolTokensFromLastInteraction[i].tokenId).interestRedeemed
      );
    }
  }
}
