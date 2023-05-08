// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {ConfigurableRoyaltyStandard} from "../../../protocol/core/ConfigurableRoyaltyStandard.sol";

contract PoolTokensRoyaltiesTest is PoolTokensBaseTest {
  function testSetRoyaltyParamsCanBeCalledByOwner(
    address receiver,
    uint256 royaltyPercent
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));
    poolTokens.setRoyaltyParams(receiver, royaltyPercent);
  }

  function testSetRoyaltyParamsCantBeCalledByNonOwner(
    address caller,
    address receiver,
    uint256 royaltyPercent
  ) public impersonating(caller) {
    vm.assume(caller != GF_OWNER);
    vm.assume(receiver != address(0));
    vm.expectRevert(bytes("AD"));
    poolTokens.setRoyaltyParams(receiver, royaltyPercent);
  }

  function testSetRoyaltyParamsSetsReceiverAndRoyaltyPercent(
    address receiver,
    uint256 royaltyPercent
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));
    poolTokens.setRoyaltyParams(receiver, royaltyPercent);
    (address _receiver, uint256 _royaltyPercent) = poolTokens.royaltyParams();
    assertEq(_receiver, receiver);
    assertEq(_royaltyPercent, royaltyPercent);
  }

  function testSetRoyaltyParamsRevertsForNullReceiver(
    uint256 royaltyPercent
  ) public impersonating(GF_OWNER) {
    vm.expectRevert("Null receiver");
    poolTokens.setRoyaltyParams(address(0), royaltyPercent);
  }

  function testEmitsRoyaltyParamsSetEvent(
    address receiver,
    uint256 royaltyPercent
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));
    vm.expectEmit(true, false, false, true);
    emit RoyaltyParamsSet({
      sender: GF_OWNER,
      newReceiver: receiver,
      newRoyaltyPercent: royaltyPercent
    });
    poolTokens.setRoyaltyParams(receiver, royaltyPercent);
  }

  function testRoyaltyInfoCalculatesPercentBasedRoyaltyUsingParams(
    address receiver
  ) public impersonating(GF_OWNER) {
    vm.assume(receiver != address(0));
    poolTokens.setRoyaltyParams(receiver, 5e15); // 50 basis points
    uint256 salePrice = 100e18;
    (address royaltyReceiver, uint256 royaltyAmount) = poolTokens.royaltyInfo(0, salePrice);
    assertEq(royaltyReceiver, receiver);
    assertEq(royaltyAmount, (salePrice * 5e15) / 1e18);
  }

  event RoyaltyParamsSet(address indexed sender, address newReceiver, uint256 newRoyaltyPercent);
}
