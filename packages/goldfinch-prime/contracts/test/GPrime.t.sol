// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GoldfinchPrime} from "../../contracts/protocol/GPrime.sol";
import {Go} from "../../contracts/protocol/core/Go.sol";
import {IUniqueIdentity} from "../../contracts/interfaces/IUniqueIdentity.sol";
import {GoldfinchConfig} from "../../contracts/protocol/core/GoldfinchConfig.sol";
import {BaseTest} from "./core/BaseTest.t.sol";
import {UniqueIdentityBaseTest} from "./core/uniqueidentity/BaseUniqueIdentity.t.sol";
import {MockReentrancyAttacker} from "./mocks/MockReentrancyAttacker.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {DepositWithPermitHelpers} from "./helpers/DepositWithPermitHelpers.t.sol";
import {IERC20WithName} from "../interfaces/IERC20WithName.sol";

contract GoldfinchPrimeTest is BaseTest, UniqueIdentityBaseTest {
  GoldfinchPrime public prime;

  address public admin = address(0x1);
  address public user1 = address(0x2);
  address public user2 = address(0x3);
  address public user3 = address(0x4);
  uint256 public testPrivateKey = 123;
  address public user4;

  uint256 public constant INITIAL_USDC_AMOUNT = 10000e6; // 10,000 USDC
  uint256 public WITHDRAWAL_FEE_IN_BPS = 0;

  function setUp() public virtual override(BaseTest, UniqueIdentityBaseTest) {
    UniqueIdentityBaseTest.setUp();

    vm.startPrank(GF_OWNER);

    // Deploy GoldfinchPrime
    prime = new GoldfinchPrime();
    prime.initialize(admin, address(protocol.gfConfig()), GF_OWNER);
    user4 = vm.addr(testPrivateKey);

    // Setup test users
    uid._mintForTest(user1, 0, 1, "");
    uid._mintForTest(user2, 0, 1, "");
    uid._mintForTest(user4, 0, 1, "");

    // Fund test users and admin
    protocol.usdc().transfer(user1, INITIAL_USDC_AMOUNT);
    protocol.usdc().transfer(user2, INITIAL_USDC_AMOUNT);
    protocol.usdc().transfer(user3, INITIAL_USDC_AMOUNT);
    protocol.usdc().transfer(user4, INITIAL_USDC_AMOUNT);
    protocol.usdc().transfer(admin, INITIAL_USDC_AMOUNT);

    // Deploy and set up Go contract
    Go go = new Go();
    go.initialize(
      GF_OWNER,
      GoldfinchConfig(address(protocol.gfConfig())),
      IUniqueIdentity(address(uid))
    );
    protocol.gfConfig().setAddress(6, address(go));

    vm.stopPrank();
  }

  function testPauseAndUnpause() public {
    vm.prank(admin);
    prime.pause();
    assertTrue(prime.paused(), "Contract should be paused");

    vm.startPrank(user1);
    vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
    prime.deposit(1000e6);
    vm.stopPrank();

    vm.prank(admin);
    prime.unpause();
    assertFalse(prime.paused(), "Contract should be unpaused");
  }

  function testZeroAmountChecks() public {
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), type(uint256).max);

    vm.expectRevert("Must receive > 0 shares");
    prime.deposit(0);

    vm.expectRevert("Must redeem > 0");
    prime.requestRedemption(0);

    vm.expectRevert("No request");
    prime.withdraw();

    vm.stopPrank();

    vm.prank(admin);
    vm.expectRevert("Amount must be > 0");
    prime.fulfillRedemption(user1, 0);
  }

  function testShareCalculationEdgeCases() public {
    // Test very small deposit
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), type(uint256).max);

    uint256 tinyDeposit = 1; // 1 atominc unit of USDC
    prime.deposit(tinyDeposit);
    uint256 expectedShares = 1e18 / 1e6;
    assertEq(prime.balanceOf(user1), expectedShares, "Incorrect shares for small deposit");

    // Test very large deposit
    uint256 largeDeposit = 1000000000e6; // 1 billion USDC
    vm.startPrank(GF_OWNER);
    protocol.usdc().transfer(user1, largeDeposit); // Fund for large deposit

    vm.startPrank(user1);
    prime.deposit(largeDeposit);
    // $1B + 1 atomic unit deposit
    expectedShares = ((1000000000e6 + 1) * 1e18) / 1e6;
    assertEq(prime.balanceOf(user1), expectedShares, "Incorrect shares for large deposit");
    vm.stopPrank();
  }

  function testInitialState() public {
    assertEq(prime.sharePrice(), 1e18, "Initial share price should be 1e18");
    assertTrue(prime.hasRole(prime.DEFAULT_ADMIN_ROLE(), GF_OWNER), "Protocol admin role not set");
    assertTrue(prime.hasRole(prime.MANAGER_ROLE(), admin), "Manager role not set");
    assertTrue(prime.hasRole(prime.PAUSER_ROLE(), admin), "Pauser role not set");
  }

  function testDeposit() public {
    uint256 depositAmount = 1000e6; // 1000 USDC

    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);

    uint256 preBalance = protocol.usdc().balanceOf(user1);
    // 1000 USDC (1000e6) -> 1000e18 shares (converting from 6 to 18 decimals)
    uint256 expectedShares = 1000e18;

    prime.deposit(depositAmount);

    assertEq(prime.balanceOf(user1), expectedShares, "Incorrect shares minted");
    assertEq(
      protocol.usdc().balanceOf(user1),
      preBalance - depositAmount,
      "Incorrect USDC balance"
    );
    assertEq(prime.availableToDrawdown(), depositAmount, "Incorrect available to drawdown");

    vm.stopPrank();
  }

  function testDepositRequiresUID() public {
    vm.startPrank(address(0x4)); // Address without UID
    protocol.usdc().approve(address(prime), 1000e6);

    vm.expectRevert("Invalid UID");
    prime.deposit(1000e6);

    vm.stopPrank();
  }

  function testDepositWorksWithIntlEntityUID() public {
    vm.startPrank(user3); // Address without UID
    protocol.usdc().approve(address(prime), 1000e6);

    vm.expectRevert("Invalid UID");
    prime.deposit(1000e6);

    uid._mintForTest(user3, 4, 1, "");
    prime.deposit(1000e6);

    vm.stopPrank();
  }

  function testUpdateSharePrice() public {
    uint256 newPrice = 2e18;

    vm.prank(admin);
    prime.updateSharePrice(newPrice);

    assertEq(prime.sharePrice(), newPrice, "Share price not updated");
  }

  function testUpdateSharePriceBeyondRange() public {
    // An amount that is way too big (implies 10x gains, which shouldn't happen for like 10 years)
    uint256 newPrice = 1e18 * 11;

    vm.prank(admin);
    vm.expectRevert("Share price out of allowed range");
    prime.updateSharePrice(newPrice);
  }

  function testOnlyManagerCanUpdatePrice() public {
    vm.prank(user1);
    vm.expectRevert();
    prime.updateSharePrice(2e18);
  }

  function testCompleteRedemptionLifecycle() public {
    // Initial deposit
    uint256 depositAmount = 1000e6; // 1000 USDC
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Request redemption
    uint256 sharesToRedeem = prime.balanceOf(user1);
    prime.requestRedemption(sharesToRedeem);

    // Verify request state
    (
      uint256 totalSharesRequested,
      uint256 sharesRedeemed,
      uint256 usdcToReceive,
      uint256 totalUsdcFulfilled,
      uint256 timestamp
    ) = prime.redemptionRequests(user1);

    assertEq(totalSharesRequested, sharesToRedeem, "Incorrect shares requested");
    assertEq(sharesRedeemed, 0, "Should have no shares redeemed");
    assertEq(usdcToReceive, 0, "Should have no USDC to receive");
    assertEq(totalUsdcFulfilled, 0, "Should have no USDC fulfilled");
    assertTrue(timestamp > 0, "Timestamp should be set");
    vm.stopPrank();

    // Manager fulfills redemption
    vm.startPrank(admin);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.fulfillRedemption(user1, depositAmount);
    vm.stopPrank();

    // Verify fulfillment state
    (totalSharesRequested, sharesRedeemed, usdcToReceive, totalUsdcFulfilled, timestamp) = prime
      .redemptionRequests(user1);

    uint256 expectedFee = (depositAmount * WITHDRAWAL_FEE_IN_BPS) / 10000; // 0.0% fee
    uint256 expectedNet = depositAmount - expectedFee;

    assertEq(usdcToReceive, expectedNet, "Incorrect net amount");
    assertEq(totalUsdcFulfilled, depositAmount, "Incorrect total fulfilled");
    assertEq(sharesRedeemed, sharesToRedeem, "Incorrect shares redeemed");

    // User withdraws
    vm.startPrank(user1);
    uint256 preBalance = protocol.usdc().balanceOf(user1);
    prime.withdraw();
    vm.stopPrank();

    assertEq(protocol.usdc().balanceOf(user1), preBalance + expectedNet, "Incorrect final balance");

    // Verify request is cleared
    (totalSharesRequested, , , , ) = prime.redemptionRequests(user1);
    assertEq(totalSharesRequested, 0, "Request should be cleared");
  }

  function testPartialRedemptions() public {
    // Initial deposit
    uint256 depositAmount = 1000e6; // 1000 USDC
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Request redemption
    uint256 sharesToRedeem = prime.balanceOf(user1);
    prime.requestRedemption(sharesToRedeem);
    vm.stopPrank();

    // Manager fulfills redemption in parts
    vm.startPrank(admin);
    protocol.usdc().approve(address(prime), depositAmount);

    uint256 firstFulfillment = 400e6;
    prime.fulfillRedemption(user1, firstFulfillment);

    uint256 secondFulfillment = 600e6;
    prime.fulfillRedemption(user1, secondFulfillment);
    vm.stopPrank();

    // User withdraws after each fulfillment
    vm.startPrank(user1);
    uint256 preBalance = protocol.usdc().balanceOf(user1);

    prime.withdraw();
    uint256 expectedFirstFee = (firstFulfillment * WITHDRAWAL_FEE_IN_BPS) / 10000;
    uint256 expectedSecondFee = (secondFulfillment * WITHDRAWAL_FEE_IN_BPS) / 10000;
    uint256 expectedTotal = firstFulfillment +
      secondFulfillment -
      expectedFirstFee -
      expectedSecondFee;

    assertEq(
      protocol.usdc().balanceOf(user1),
      preBalance + expectedTotal,
      "Incorrect final balance after partial redemptions"
    );
    vm.stopPrank();
  }

  function testRedemptionCancellation() public {
    // Initial deposit
    uint256 depositAmount = 1000e6;
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Request redemption
    uint256 sharesToRedeem = prime.balanceOf(user1);
    prime.requestRedemption(sharesToRedeem);

    // Cancel redemption
    prime.cancelRedemption();

    // Verify state
    assertEq(prime.balanceOf(user1), sharesToRedeem, "Shares should be returned");
    (uint256 totalSharesRequested, , , , ) = prime.redemptionRequests(user1);
    assertEq(totalSharesRequested, 0, "Request should be cleared");

    // Cannot cancel non-existent request
    vm.expectRevert("No request");
    prime.cancelRedemption();
    vm.stopPrank();
  }

  function testSharePriceUpdateDuringRedemption() public {
    // Initial deposit at 1e18 share price
    uint256 depositAmount = 1000e6;
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Request redemption
    uint256 sharesToRedeem = prime.balanceOf(user1);
    prime.requestRedemption(sharesToRedeem);
    vm.stopPrank();

    // Manager updates share price
    vm.startPrank(admin);
    uint256 newSharePrice = 2e18; // Double the share price
    prime.updateSharePrice(newSharePrice);

    // Fulfill redemption at new share price
    protocol.usdc().approve(address(prime), depositAmount * 2);
    prime.fulfillRedemption(user1, depositAmount * 2);
    vm.stopPrank();

    // Verify calculations use new share price
    (uint256 totalSharesRequested, uint256 sharesRedeemed, uint256 usdcToReceive, , ) = prime
      .redemptionRequests(user1);

    assertEq(sharesRedeemed, totalSharesRequested, "Should redeem all shares");
    uint256 expectedFee = (depositAmount * 2 * WITHDRAWAL_FEE_IN_BPS) / 10000;
    assertEq(usdcToReceive, (depositAmount * 2) - expectedFee, "Incorrect USDC to receive");
  }

  function testGetShareValue() public {
    // Deposit $100 USDC
    uint256 depositAmount = 100e6; // 100 USDC
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Get the number of shares minted
    uint256 shares = prime.balanceOf(user1);
    vm.stopPrank();

    // Using getShareValue on those shares should return $100 USDC
    uint256 usdcValue = prime.getShareValue(shares);
    assertEq(usdcValue, depositAmount, "getShareValue should return original deposit amount");

    // Test after share price increase
    vm.startPrank(admin);
    uint256 newSharePrice = 1.1e18; // $1.10
    prime.updateSharePrice(newSharePrice);
    vm.stopPrank();

    // Should now be worth $110 USDC
    usdcValue = prime.getShareValue(shares);
    assertEq(usdcValue, 110e6, "getShareValue should return increased value after price update");
  }

  function testMaxValues() public {
    // Test with large but reasonable values
    uint256 maxDeposit = 1000000000e6; // 1 billion USDC

    vm.startPrank(GF_OWNER);
    protocol.usdc().transfer(user1, maxDeposit);
    vm.stopPrank();

    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), maxDeposit);
    prime.deposit(maxDeposit);

    uint256 shares = prime.balanceOf(user1);
    prime.requestRedemption(shares);
    vm.stopPrank();

    // Manager fulfills max redemption
    vm.startPrank(admin);
    protocol.usdc().approve(address(prime), maxDeposit);

    // Fund admin with enough USDC
    vm.startPrank(GF_OWNER);
    protocol.usdc().transfer(admin, maxDeposit);
    vm.stopPrank();

    vm.startPrank(admin);
    prime.fulfillRedemption(user1, maxDeposit);
    vm.stopPrank();

    // Verify no overflows occurred
    (
      uint256 totalSharesRequested,
      uint256 sharesRedeemed,
      uint256 usdcToReceive,
      uint256 totalUsdcFulfilled,

    ) = prime.redemptionRequests(user1);

    assertTrue(totalSharesRequested > 0, "Shares requested should be recorded");
    assertTrue(sharesRedeemed > 0, "Shares should be redeemed");
    assertTrue(usdcToReceive > 0, "USDC should be available");
    assertTrue(totalUsdcFulfilled > 0, "Fulfillment should be recorded");
  }

  function testReentrancyProtection() public {
    // Deploy malicious contract that would try to reenter
    MockReentrancyAttacker attacker = new MockReentrancyAttacker(
      address(prime),
      address(protocol.usdc())
    );

    // Fund attacker
    vm.startPrank(GF_OWNER);
    protocol.usdc().transfer(address(attacker), 1000e6);
    uid._mintForTest(address(attacker), 0, 1, "");
    vm.stopPrank();

    // Attempt reentrancy attack
    vm.expectRevert();
    attacker.attack();
  }

  function testTransferRestrictions() public {
    uint256 depositAmount = 1000e6;

    // First deposit to get some shares
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Try to transfer shares directly
    uint256 transferAmount = prime.balanceOf(user1);
    vm.expectRevert("Shares are non-transferable");
    prime.transfer(user2, transferAmount);

    // Try to approve another address to spend shares
    vm.expectRevert("Shares are non-transferable");
    prime.approve(user2, transferAmount);
  }

  function testRoleManagement() public {
    address newManager = address(0x123);

    // Only admin can grant roles
    vm.startPrank(newManager);
    bytes32 role = prime.MANAGER_ROLE();
    bytes32 defaultAdminRole = prime.DEFAULT_ADMIN_ROLE();
    vm.expectRevert(
      abi.encodeWithSignature(
        "AccessControlUnauthorizedAccount(address,bytes32)",
        newManager,
        defaultAdminRole
      )
    );
    prime.grantRole(role, user1);
    vm.stopPrank();

    // Admin can grant roles
    vm.startPrank(GF_OWNER);
    prime.grantRole(prime.MANAGER_ROLE(), newManager);
    assertTrue(prime.hasRole(prime.MANAGER_ROLE(), newManager));
    vm.stopPrank();

    // Test granting the role doesn't make them an admin
    vm.startPrank(newManager);
    vm.expectRevert(
      abi.encodeWithSignature(
        "AccessControlUnauthorizedAccount(address,bytes32)",
        newManager,
        defaultAdminRole
      )
    );
    prime.grantRole(role, user1);
    vm.stopPrank();

    // Test newManager cannot revoke role from owner
    vm.startPrank(newManager);
    vm.expectRevert();
    prime.revokeRole(defaultAdminRole, GF_OWNER);
    vm.stopPrank();

    // Admin can revoke roles
    vm.startPrank(GF_OWNER);
    prime.revokeRole(prime.MANAGER_ROLE(), newManager);
    assertFalse(prime.hasRole(prime.MANAGER_ROLE(), newManager));
    vm.stopPrank();
  }

  function testDepositWithPermit() public {
    uint256 depositAmount = 1000e6; // 1000 USDC

    // First verify that a regular deposit would fail without approval
    vm.startPrank(user4);
    vm.expectRevert(
      abi.encodeWithSignature(
        "ERC20InsufficientAllowance(address,uint256,uint256)",
        address(prime),
        0,
        depositAmount
      )
    );
    prime.deposit(depositAmount);
    vm.stopPrank();

    // Now test depositWithPermit
    uint256 deadline = block.timestamp + 1 days;
    bytes32 permitHash = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(protocol.usdc())),
      user4,
      address(prime),
      depositAmount,
      ERC20PermitUpgradeable(address(protocol.usdc())).nonces(user4),
      deadline
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(testPrivateKey, permitHash); // user4's private key

    vm.startPrank(user4);
    uint256 preBalance = protocol.usdc().balanceOf(user4);
    uint256 expectedShares = 1000e18; // 1000e6 USDC -> 1000e18 shares

    prime.depositWithPermit(depositAmount, deadline, v, r, s);

    assertEq(prime.balanceOf(user4), expectedShares, "Incorrect shares minted");
    assertEq(
      protocol.usdc().balanceOf(user4),
      preBalance - depositAmount,
      "Incorrect USDC balance"
    );
    assertEq(prime.availableToDrawdown(), depositAmount, "Incorrect available to drawdown");
    vm.stopPrank();
  }

  function testDepositWithPermitWhenPaused() public {
    uint256 depositAmount = 1000e6;
    uint256 deadline = block.timestamp + 1 days;

    bytes32 permitHash = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(protocol.usdc())),
      user1,
      address(prime),
      depositAmount,
      ERC20PermitUpgradeable(address(protocol.usdc())).nonces(user1),
      deadline
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x2, permitHash);

    vm.prank(admin);
    prime.pause();

    vm.startPrank(user1);
    vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
    prime.depositWithPermit(depositAmount, deadline, v, r, s);
    vm.stopPrank();
  }

  function testDepositWithPermitRequiresUID() public {
    uint256 depositAmount = 1000e6;
    uint256 deadline = block.timestamp + 1 days;
    uint256 testPrivateKey2 = 456;
    address user5 = vm.addr(testPrivateKey2);

    bytes32 permitHash = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(protocol.usdc())),
      user5,
      address(prime),
      depositAmount,
      ERC20PermitUpgradeable(address(protocol.usdc())).nonces(user5),
      deadline
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(testPrivateKey2, permitHash); // user3's private key

    vm.startPrank(user5);
    vm.expectRevert("Invalid UID");
    prime.depositWithPermit(depositAmount, deadline, v, r, s);
    vm.stopPrank();
  }

  function testDepositWithPermitExpired() public {
    uint256 depositAmount = 1000e6;
    uint256 deadline = block.timestamp - 1; // Expired deadline

    bytes32 permitHash = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(protocol.usdc())),
      user1,
      address(prime),
      depositAmount,
      ERC20PermitUpgradeable(address(protocol.usdc())).nonces(user1),
      deadline
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x2, permitHash);

    vm.startPrank(user1);
    vm.expectRevert(abi.encodeWithSignature("ERC2612ExpiredSignature(uint256)", deadline));
    prime.depositWithPermit(depositAmount, deadline, v, r, s);
    vm.stopPrank();
  }

  function testDrawdown() public {
    // Setup: multiple deposits
    uint256 deposit1 = 1000e6;
    uint256 deposit2 = 500e6;

    // First user deposits
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), deposit1);
    prime.deposit(deposit1);
    vm.stopPrank();

    // Second user deposits
    vm.startPrank(user2);
    protocol.usdc().approve(address(prime), deposit2);
    prime.deposit(deposit2);
    vm.stopPrank();

    // Verify total available to drawdown
    uint256 totalDeposits = deposit1 + deposit2;
    assertEq(prime.availableToDrawdown(), totalDeposits, "Incorrect initial available to drawdown");

    // Test partial drawdown
    uint256 firstDrawdown = 700e6;
    vm.startPrank(admin);
    uint256 preBalance = protocol.usdc().balanceOf(admin);
    prime.drawdown(firstDrawdown);

    // Verify balances after first drawdown
    assertEq(
      protocol.usdc().balanceOf(admin),
      preBalance + firstDrawdown,
      "Admin didn't receive USDC"
    );
    assertEq(
      prime.availableToDrawdown(),
      totalDeposits - firstDrawdown,
      "Incorrect available after first drawdown"
    );

    // Test second drawdown
    uint256 secondDrawdown = totalDeposits - firstDrawdown; // Remaining amount
    prime.drawdown(secondDrawdown);

    // Verify final state
    assertEq(prime.availableToDrawdown(), 0, "Should have no USDC available to drawdown");
    assertEq(
      protocol.usdc().balanceOf(admin),
      preBalance + totalDeposits,
      "Admin didn't receive all USDC"
    );

    // Verify can't drawdown more than available
    vm.expectRevert("Insufficient available amount");
    prime.drawdown(1);
    vm.stopPrank();
  }

  function testRedemptionOverfulfillmentProtection() public {
    // Initial deposit
    uint256 depositAmount = 1000e6; // 1000 USDC
    vm.startPrank(user1);
    protocol.usdc().approve(address(prime), depositAmount);
    prime.deposit(depositAmount);

    // Request partial redemption
    uint256 sharesToRedeem = prime.balanceOf(user1) / 2; // Only redeem half
    prime.requestRedemption(sharesToRedeem);
    vm.stopPrank();

    // Try to fulfill with more USDC than corresponds to requested shares
    vm.startPrank(admin);
    protocol.usdc().approve(address(prime), depositAmount);

    // Calculate the correct USDC amount for the shares and try to send more
    uint256 correctUsdcAmount = depositAmount / 2; // Since we're redeeming half the shares
    uint256 tooMuchUsdc = correctUsdcAmount + 100e6; // Try to send 100 USDC more

    vm.expectRevert("You are trying to fulfill too much");
    prime.fulfillRedemption(user1, tooMuchUsdc);

    // Verify we can still fulfill with the correct amount
    prime.fulfillRedemption(user1, correctUsdcAmount);
    vm.stopPrank();

    // Verify the fulfillment succeeded with correct amount
    (
      uint256 totalSharesRequested,
      uint256 sharesRedeemed,
      uint256 usdcToReceive,
      uint256 totalUsdcFulfilled,

    ) = prime.redemptionRequests(user1);

    assertEq(sharesRedeemed, sharesToRedeem, "Should have redeemed requested shares");
    assertEq(totalUsdcFulfilled, correctUsdcAmount, "Should have fulfilled correct USDC amount");
  }
}
