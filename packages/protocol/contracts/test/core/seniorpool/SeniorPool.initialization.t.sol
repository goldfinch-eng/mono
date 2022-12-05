// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {TestSeniorPool} from "../../../test/TestSeniorPool.sol";

contract SeniorPoolInitializationTest is SeniorPoolBaseTest {
  /*================================================================================
  Initialization
  ================================================================================*/
  function testInitializationCannotBeCalledTwice(
    address caller
  ) public onlyAllowListed(caller) impersonating(caller) {
    vm.expectRevert("Contract instance has already been initialized");
    sp.initialize(GF_OWNER, gfConfig);
  }

  /*================================================================================
  Epoch Initialization
  ================================================================================*/
  function testEpochInitialiazationSucceedsForOwner() public impersonating(GF_OWNER) {
    TestSeniorPool sp2 = new TestSeniorPool();
    sp2.initialize(GF_OWNER, gfConfig);

    usdc.transfer(address(sp2), usdcVal(100));

    assertZero(sp2.epochDuration());
    assertZero(sp2.epochAt(0).endsAt);
    assertZero(sp2._usdcAvailableRaw());

    sp2.initializeEpochs();

    assertEq(sp2.epochDuration(), 2 weeks);
    assertEq(sp2.epochAt(0).endsAt, block.timestamp);
    assertEq(sp2.usdcAvailable(), usdcVal(100));
  }

  function testEpochInitializationCannotBeCalledTwice() public impersonating(GF_OWNER) {
    TestSeniorPool sp2 = new TestSeniorPool();
    sp2.initialize(GF_OWNER, gfConfig);
    sp2.initializeEpochs();
    vm.expectRevert();
    sp2.initializeEpochs();
  }

  function testEpochInitializationFailsForNonOwner(
    address nonOwner
  ) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    TestSeniorPool sp2 = new TestSeniorPool();
    sp2.initialize(GF_OWNER, gfConfig);

    vm.expectRevert("Must have admin role to perform this action");
    sp2.initializeEpochs();
  }
}
