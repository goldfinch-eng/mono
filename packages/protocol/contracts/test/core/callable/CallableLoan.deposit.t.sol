// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ICallableLoan, LoanPhase} from "../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

import {SaturatingSub} from "../../../library/SaturatingSub.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanDepositTest is CallableLoanBaseTest {
  using SaturatingSub for uint256;
  event DepositMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 amount
  );
  event DepositsLocked(address indexed loan);

  function testDepositWithoutGoListOrUid() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.InvalidUIDForDepositor.selector, address(this))
    );
    callableLoan.deposit(3, 1);
  }

  function testDepositWorksIfGolistedAndWithoutAllowedUid() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    _startImpersonation(BORROWER);
    uint256[] memory allowedTypes = new uint256[](1);
    allowedTypes[0] = 0; // legacy UID type
    callableLoan.setAllowedUIDTypes(allowedTypes);
    _stopImpersonation();
    addToGoList(DEPOSITOR);
    usdc.approve(address(callableLoan), type(uint256).max);
    uint256 poolToken = callableLoan.deposit(3, usdcVal(10));
    assertEq(poolToken, 1);
  }

  function testDepositWorksIfAllowedUidButNotGoListed() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);
    uint256 poolToken = callableLoan.deposit(3, usdcVal(100));
    assertEq(poolToken, 1);
  }

  function testDepositRevertsBeforeFundableAt(
    uint256 fundableAt,
    uint256 warpDestination
  ) public impersonating(DEPOSITOR) {
    fundableAt = bound(fundableAt, 1, 1460 days);
    warpDestination = bound(warpDestination, block.timestamp, block.timestamp + fundableAt);
    vm.warp(warpDestination);
    (CallableLoan callableLoan, ) = callableLoanBuilder
      .withFundableAt(block.timestamp + fundableAt)
      .build(BORROWER);
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.InvalidLoanPhase.selector,
        LoanPhase.Prefunding,
        LoanPhase.Funding
      )
    );
    callableLoan.deposit(3, usdcVal(1));
  }

  function testDepositRevertsForZeroDeposit() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    vm.expectRevert(abi.encodeWithSelector(ICallableLoanErrors.ZeroDepositAmount.selector));
    callableLoan.deposit(3, usdcVal(0));
  }

  function testDepositRevertsIfPoolLocked() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);
    depositAndDrawdown(callableLoan, usdcVal(100), DEPOSITOR);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.InvalidLoanPhase.selector,
        LoanPhase.DrawdownPeriod,
        LoanPhase.Funding
      )
    );
    callableLoan.deposit(3, usdcVal(100));
  }

  function testDepositRevertsForInvalidTranche(
    uint256 invalidTranche
  ) public impersonating(DEPOSITOR) {
    vm.assume(invalidTranche != 3);
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.MustDepositToUncalledTranche.selector,
        invalidTranche,
        callableLoan.uncalledCapitalTrancheIndex()
      )
    );
    callableLoan.deposit(invalidTranche, usdcVal(100));
  }

  function testDepositUpdatesTrancheInfoAndMintsToken(
    uint256 depositAmount
  ) public impersonating(DEPOSITOR) {
    vm.assume(
      depositAmount <= usdc.balanceOf(DEPOSITOR) &&
        depositAmount < callableLoanBuilder.DEFAULT_LIMIT() &&
        depositAmount > 0
    );
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(DEPOSITOR, 3, 1, depositAmount);

    uint256 poolToken = callableLoan.deposit(3, depositAmount);

    ICallableLoan.UncalledCapitalInfo memory uncalledCapital = callableLoan
      .getUncalledCapitalInfo();

    assertEq(
      uncalledCapital.principalDeposited,
      depositAmount,
      "Uncalled capital has the deposits"
    );
    assertEq(
      uncalledCapital.principalPaid,
      depositAmount,
      "Haven't drawndown yet - principalPaid should equal principalDeposited"
    );
    assertEq(uncalledCapital.interestPaid, 0, "No payments have come in");
    assertEq(uncalledCapital.principalReserved, 0, "No payments have come in");

    // Token info is correct
    assertEq(poolTokens.ownerOf(poolToken), address(DEPOSITOR));
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(tokenInfo.principalAmount, depositAmount);
    assertEq(tokenInfo.tranche, 3);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(callableLoan)), depositAmount);
  }

  function testDepositTrancheInfoUpdatedForTwoDeposits(
    uint256 amount1,
    uint256 amount2
  ) public impersonating(DEPOSITOR) {
    vm.assume(amount1 > 0 && amount2 > 0);
    vm.assume(
      callableLoanBuilder.DEFAULT_LIMIT().saturatingSub(amount1).saturatingSub(amount2) > 0
    );
    uint256 total = amount1 + amount2;
    vm.assume(total <= usdc.balanceOf(DEPOSITOR));

    (CallableLoan callableLoan, ) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    callableLoan.deposit(3, amount1);
    callableLoan.deposit(3, amount2);

    ICallableLoan.UncalledCapitalInfo memory uncalledCapital = callableLoan
      .getUncalledCapitalInfo();

    assertEq(
      uncalledCapital.principalDeposited,
      amount1 + amount2,
      "Uncalled capital has the deposits"
    );
    assertEq(
      uncalledCapital.principalPaid,
      amount1 + amount2,
      "Haven't drawndown yet - principalPaid should equal principalDeposited"
    );
    assertEq(uncalledCapital.interestPaid, 0, "No payments have come in");
    assertEq(uncalledCapital.principalReserved, 0, "No payments have come in");

    assertEq(usdc.balanceOf(address(callableLoan)), amount1 + amount2, "pool has balance");
    assertEq(poolTokens.balanceOf(DEPOSITOR), 2, "depositor has two pool tokens");
  }

  function testLockPoolEmitsEvent() public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectEmit(true, true, true, true);
    emit DepositsLocked(address(callableLoan));
    depositAndDrawdown(callableLoan, usdcVal(100), DEPOSITOR);
  }

  function testDepositUsingPermit(uint256 userPrivateKey, uint256 depositAmount) public {
    vm.assume(
      depositAmount <= usdc.balanceOf(DEPOSITOR) &&
        depositAmount < callableLoanBuilder.DEFAULT_LIMIT() &&
        depositAmount > 0
    );
    vm.assume(userPrivateKey != 0);
    // valid private key space is from [1, secp256k1n − 1]
    vm.assume(
      userPrivateKey <= uint256(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141)
    );
    address user = vm.addr(userPrivateKey);

    fundAddress(user, depositAmount);

    (CallableLoan callableLoan, ) = defaultCallableLoan();

    uint256 nonce = usdc.nonces(user);
    uint256 deadline = block.timestamp + 1;
    // Get signature for permit
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      usdc,
      user,
      address(callableLoan),
      depositAmount,
      nonce,
      deadline
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);

    vm.expectEmit(true, true, true, true);
    emit DepositMade(user, 3, 1, depositAmount);

    uid._mintForTest(user, 1, depositAmount, "");
    // Deposit with permit
    _startImpersonation(user);
    uint256 poolTokenId = callableLoan.depositWithPermit(3, depositAmount, deadline, v, r, s);
    _stopImpersonation();

    ICallableLoan.UncalledCapitalInfo memory uncalledCapital = callableLoan
      .getUncalledCapitalInfo();

    assertEq(
      uncalledCapital.principalDeposited,
      depositAmount,
      "Uncalled capital has the deposits"
    );
    assertEq(
      uncalledCapital.principalPaid,
      depositAmount,
      "Haven't drawndown yet - principalPaid should equal principalDeposited"
    );
    assertEq(uncalledCapital.interestPaid, 0, "No payments have come in");
    assertEq(uncalledCapital.principalReserved, 0, "No payments have come in");

    assertEq(usdc.balanceOf(address(callableLoan)), depositAmount, "pool has balance");
    assertEq(poolTokens.balanceOf(user), 1, "user has two pool tokens");

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    assertEq(tokenInfo.principalAmount, depositAmount);
    assertEq(tokenInfo.tranche, 3);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);
    assertZero(usdc.allowance(user, address(callableLoan)));
  }

  function testLimitDoesNotAllowDepositThatExceedsLimit(
    uint256 limit,
    uint256 depositAmount
  ) public impersonating(DEPOSITOR) {
    limit = bound(limit, usdcVal(1), usdcVal(100_000_000));
    depositAmount = bound(depositAmount, limit + 1, limit * 10);
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanBuilder.withLimit(limit).build(
      BORROWER
    );

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.DepositExceedsLimit.selector,
        depositAmount,
        0,
        limit
      )
    );
    callableLoan.deposit(3, depositAmount);
  }
}
