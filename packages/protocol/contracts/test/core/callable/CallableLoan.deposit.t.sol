// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ICallableLoan} from "../../../interfaces/ICallableLoan.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanDepositTest is CallableLoanBaseTest {
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
    vm.expectRevert(bytes("NA"));
    callableLoan.deposit(1, 1);
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
    uint256 poolToken = callableLoan.deposit(1, usdcVal(10));
    assertEq(poolToken, 1);
  }

  function testDepositWorksIfAllowedUidButNotGoListed() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);
    uint256 poolToken = callableLoan.deposit(1, usdcVal(100));
    assertEq(poolToken, 1);
  }

  function testDepositRevertsForZeroDeposit() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("IA"));
    callableLoan.deposit(1, usdcVal(0));
  }

  function testDepositRevertsIfPoolLocked() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    console.log("1");
    usdc.approve(address(callableLoan), type(uint256).max);
    console.log("2");
    callableLoan.deposit(1, usdcVal(100));
    console.log("3");
    // TODO: Drawdown to lock pool
    console.log("4");
    vm.expectRevert(bytes("TL"));
    console.log("5");
    callableLoan.deposit(1, usdcVal(100));
  }

  function testDepositRevertsForInvalidTranche() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("IT"));
    callableLoan.deposit(2, usdcVal(100));
  }

  function testDepositUpdatesTrancheInfoAndMintsToken() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(DEPOSITOR, 1, 1, usdcVal(100));

    uint256 poolToken = callableLoan.deposit(1, usdcVal(100));

    // TODO: Uncalled capital tranche info has principal deposited
    // ITranchedPool.TrancheInfo memory uncalledCapital = callableLoan.getTranche(1);
    // assertEq(uncalledCapital.principalDeposited, usdcVal(100));

    // Token info is correct
    assertEq(poolTokens.ownerOf(poolToken), address(DEPOSITOR));
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 1);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(callableLoan)), usdcVal(100));
  }

  function testDepositTrancheInfoUpdatedForTwoDeposits(
    uint256 amount1,
    uint256 amount2
  ) public impersonating(DEPOSITOR) {
    vm.assume(amount1 > 0 && amount2 > 0);
    uint256 total = amount1 + amount2; // Check for underflow
    vm.assume(amount2 < total && total <= usdc.balanceOf(DEPOSITOR));

    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    callableLoan.deposit(1, amount1);
    callableLoan.deposit(1, amount2);

    // TODO: Uncalled capital tranche info has principal deposited
    // ITranchedPool.TrancheInfo memory uncalledCapital = callableLoan.getTranche(1);

    // assertEq(uncalledCapital.principalDeposited, amount1 + amount2, "junior tranche has deposits");
    // assertEq(usdc.balanceOf(address(callableLoan)), amount1 + amount2, "pool has balance");
    // // TODO: Eventually should just be a single NFT
    // assertEq(poolTokens.balanceOf(DEPOSITOR), 2, "depositor has two pool tokens");
  }

  function testLockPoolEmitsEvent() public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectEmit(true, false, false, true);
    // TODO: Should emit pool locked instead of tranche locked.
    emit DepositsLocked(address(callableLoan));
    // TODO: Drawdown to lock pool
  }

  function testDepositFailsForInvalidTranches(uint256 trancheId) public {
    vm.assume(trancheId > 2);
    (CallableLoan callableLoan, ) = defaultCallableLoan();

    _startImpersonation(DEPOSITOR);
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("IT"));
    callableLoan.deposit(trancheId, usdcVal(1));
    _stopImpersonation();
  }

  function testDepositUsingPermit(uint256 userPrivateKey) public {
    vm.assume(userPrivateKey != 0);
    // valid private key space is from [1, secp256k1n − 1]
    vm.assume(
      userPrivateKey <= uint256(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141)
    );
    address user = vm.addr(userPrivateKey);

    fundAddress(user, usdcVal(100));

    (CallableLoan callableLoan, ) = defaultCallableLoan();

    uint256 nonce = usdc.nonces(user);
    uint256 deadline = block.timestamp + 1;
    // Get signature for permit
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      usdc,
      user,
      address(callableLoan),
      usdcVal(100),
      nonce,
      deadline
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);

    vm.expectEmit(true, true, true, true);
    emit DepositMade(user, 1, 1, usdcVal(100));

    uid._mintForTest(user, 1, usdcVal(100), "");
    // Deposit with permit
    _startImpersonation(user);
    uint256 poolTokenId = callableLoan.depositWithPermit(1, usdcVal(100), deadline, v, r, s);
    _stopImpersonation();

    // TODO:
    // ITranchedPool.TrancheInfo memory uncalledCapital = callableLoan.getTranche(1);
    // assertEq(uncalledCapital.principalDeposited, usdcVal(100));

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 1);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);
    assertZero(usdc.allowance(user, address(callableLoan)));
  }

  function testLimitDoesNotIncreaseWhenDepositsExceedLimit(
    uint256 limit,
    uint256 depositAmount
  ) public {
    limit = bound(limit, usdcVal(1), usdcVal(10_000_000));
    depositAmount = bound(depositAmount, limit, limit * 10);

    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    setMaxLimit(callableLoan, limit);

    deposit(callableLoan, 3, depositAmount, DEPOSITOR);
    // TODO: Drawdown to lock pool
    assertEq(cl.limit(), limit);
  }
}
