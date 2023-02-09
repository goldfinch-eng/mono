// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "../BaseTest.t.sol";
import {GFI} from "../../../protocol/core/GFI.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GFITest is BaseTest {
  GoldfinchConfig internal gfConfig;
  GFI internal gfi;

  function setUp() public override {
    super.setUp();

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    gfi = GFI(address(protocol.gfi()));

    _startImpersonation(GF_OWNER);
    gfi.mint(GF_OWNER, 1e10);

    fuzzHelper.exclude(address(gfi));
    _stopImpersonation();
  }

  function testSymbolIsGfi() public {
    assertEq(gfi.symbol(), "GFI");
  }

  function testNameIsGoldfinch() public {
    assertEq(gfi.name(), "Goldfinch");
  }

  function testOwnerCanPause() public impersonating(GF_OWNER) {
    gfi.pause();
    vm.expectRevert("Pausable: paused");
    gfi.mint(address(this), 1);
  }

  function testNonOwnerCannotPause(
    address nonOwner
  ) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert("Must be pauser");
    gfi.pause();
  }

  function testOwnerCanUnpause() public impersonating(GF_OWNER) {
    gfi.pause();
    assertTrue(gfi.paused());
    gfi.unpause();
    assertFalse(gfi.paused());
  }

  function testNonOwnerCannotUnpause(address nonOwner) public onlyAllowListed(nonOwner) {
    _startImpersonation(GF_OWNER);
    gfi.pause();
    assertTrue(gfi.paused());
    _startImpersonation(nonOwner);
    vm.expectRevert("Must be pauser");
    gfi.pause();
  }

  function testOwnerHasOwnerRole() public {
    assertTrue(gfi.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
  }

  function testOwnerHasPauserRole() public {
    assertTrue(gfi.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
  }

  function testOwnerHasMinterRole() public {
    assertTrue(gfi.hasRole(TestConstants.MINTER_ROLE, GF_OWNER));
  }

  function testNonOwnerDoesntHaveOwnerRole(address nonOwner) public onlyAllowListed(nonOwner) {
    assertFalse(gfi.hasRole(TestConstants.OWNER_ROLE, nonOwner));
  }

  function testNonOwnerDoesntHavePauserRole(address nonOwner) public onlyAllowListed(nonOwner) {
    assertFalse(gfi.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
  }

  function testNonOwnerDoesntHaveMinterRole(address nonOwner) public onlyAllowListed(nonOwner) {
    assertFalse(gfi.hasRole(TestConstants.MINTER_ROLE, nonOwner));
  }

  function testCapInitiallySetTo1e26() public {
    assertEq(gfi.cap(), 1e26);
  }

  function testAdminCanIncreaseCap() public impersonating(GF_OWNER) {
    gfi.setCap(1e26 * 2);
    assertEq(gfi.cap(), 1e26 * 2);
  }

  function testAdminCantDecreaseCapBelowTotalSupply(uint256 newCap) public impersonating(GF_OWNER) {
    newCap = bound(newCap, 0, gfi.totalSupply() - 1);
    vm.expectRevert("Cannot decrease the cap below existing supply");
    gfi.setCap(newCap);
  }

  function testSetCapEmitsAnEvent(uint256 newCap) public impersonating(GF_OWNER) {
    newCap = bound(newCap, gfi.totalSupply(), gfi.cap());
    vm.expectEmit(true, false, false, true);
    emit CapUpdated(GF_OWNER, newCap);
    gfi.setCap(newCap);
  }

  function testNonOwnerCannotSetCap(
    address notOwner,
    uint256 newCap
  ) public onlyAllowListed(notOwner) impersonating(notOwner) {
    newCap = bound(newCap, gfi.totalSupply(), gfi.cap());
    vm.expectRevert("Must be owner");
    gfi.setCap(newCap);
  }

  function testCannotMintPastTheCap(uint256 mintAmount) public impersonating(GF_OWNER) {
    mintAmount = bound(
      mintAmount,
      gfi.cap() - gfi.totalSupply() + 1,
      type(uint256).max - gfi.cap()
    );
    vm.expectRevert("Cannot mint more than cap");
    gfi.mint(address(this), mintAmount);
  }

  function testCanMintUpToCap(uint256 mintAmount) public impersonating(GF_OWNER) {
    mintAmount = bound(mintAmount, 0, gfi.cap() - gfi.totalSupply());
    uint256 oldSupply = gfi.totalSupply();
    gfi.mint(address(this), mintAmount);
    assertEq(oldSupply + mintAmount, gfi.totalSupply());
  }

  function testMintingRevertsWhenPaused() public impersonating(GF_OWNER) {
    gfi.pause();
    vm.expectRevert("Pausable: paused");
    gfi.mint(address(this), 1);
  }

  function testNonMinterCantMint(
    address notMinter,
    uint256 mintAmount
  ) public onlyAllowListed(notMinter) impersonating(notMinter) {
    vm.expectRevert("Must be minter");
    gfi.mint(address(this), mintAmount);
  }

  event CapUpdated(address indexed who, uint256 cap);
}
