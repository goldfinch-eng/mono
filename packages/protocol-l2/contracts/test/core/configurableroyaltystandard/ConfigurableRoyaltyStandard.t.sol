// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseTest} from "../BaseTest.t.sol";
import {TestConfigurableRoyaltyStandard} from "../../TestConfigurableRoyaltyStandard.sol";

contract ConfigurableRoyaltyStandardTest is BaseTest {
  TestConfigurableRoyaltyStandard internal standard;

  function setUp() public override {
    super.setUp();
    standard = new TestConfigurableRoyaltyStandard(GF_OWNER);
  }

  function testSupportsERC2981() public {
    assertTrue(standard.supportsInterface(bytes4(0x2a55205a)));
  }

  function testOwnerCanSetRoyaltyParams(
    address receiver,
    uint256 percent
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));

    // Assert values are uninitialized
    (address oldReceiver, uint256 oldPercent) = standard.royaltyParams();
    assertEq(oldReceiver, address(0));
    assertZero(oldPercent);

    standard.setRoyaltyParams(receiver, percent);
    // Should be the same result for any token id and sale price
    (address newReceiver, uint256 newPercent) = standard.royaltyParams();
    assertEq(newReceiver, receiver);
    assertEq(newPercent, percent);
  }

  function testSetRoyaltyParamsEmitsEvent(
    address receiver,
    uint256 percent
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));
    vm.expectEmit(true, false, false, true);
    emit RoyaltyParamsSet(GF_OWNER, receiver, percent);
    standard.setRoyaltyParams(receiver, percent);
  }

  function testCantSetReceiverToNullAddress(uint256 percent) public impersonating(GF_OWNER) {
    vm.expectRevert("Null receiver");
    standard.setRoyaltyParams(address(0), percent);
  }

  function testNonOwnerCantSetRoyaltyParams(
    address notOwner,
    address receiver,
    uint256 percent
  ) public onlyAllowListed(notOwner) impersonating(notOwner) {
    vm.assume(receiver != address(0));
    vm.expectRevert(bytes("AD"));
    standard.setRoyaltyParams(receiver, percent);
  }

  function testRoyaltyInfoCalculatesRoyaltyFeeUsingConfiguredParams(
    address _receiver
  ) public onlyAllowListed(_receiver) impersonating(GF_OWNER) {
    uint256 fiftyBasisPoints = 5e15;
    standard.setRoyaltyParams(_receiver, fiftyBasisPoints);

    uint256 tokenId = 1;
    uint256 salePrice = 100e18;
    // Sale price is 100 units
    (address receiver, uint256 royalty) = standard.royaltyInfo(tokenId, salePrice);

    assertEq(receiver, _receiver);
    assertEq(royalty, (salePrice * fiftyBasisPoints) / 1e18);
  }

  event RoyaltyParamsSet(address indexed sender, address newReceiver, uint256 newRoyaltyPercent);
}
