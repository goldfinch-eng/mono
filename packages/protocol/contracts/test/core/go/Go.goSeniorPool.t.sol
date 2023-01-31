// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoBaseTest} from "./BaseGo.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {StakingRewards} from "../../../rewards/StakingRewards.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";

contract GoGoSeniorPoolTest is GoBaseTest {
  uint256[] internal seniorPoolIdTypes;

  function setUp() public override {
    super.setUp();

    seniorPoolIdTypes = new uint256[](4);
    seniorPoolIdTypes[0] = 0;
    seniorPoolIdTypes[1] = 1;
    seniorPoolIdTypes[2] = 3;
    seniorPoolIdTypes[3] = 4;
  }

  function testGetSeniorPoolIdTypesReturnsSeniorPoolIdTypes() public {
    uint256[] memory _seniorPoolUidTypes = go.getSeniorPoolIdTypes();
    for (uint256 i = 0; i < _seniorPoolUidTypes.length; ++i)
      assertEq(_seniorPoolUidTypes[i], seniorPoolIdTypes[i]);
  }

  function testGoSeniorPoolRejectsZeroAddress() public {
    vm.expectRevert("Zero address is not go-listed");
    go.goSeniorPool(address(0));
  }

  function testGoSeniorPoolReturnsTrueForStakignRewards() public impersonating(GF_OWNER) {
    assertTrue(go.goSeniorPool(address(protocol.stakingRewards())));
  }

  function testGoSeniorPoolReturnsTrueIfUserHasNonUsUidAndNotLegacyGoListed(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    for (uint256 i = 0; i < seniorPoolIdTypes.length; ++i) {
      uint256 uidType = seniorPoolIdTypes[i];
      uid._mintForTest(user, uidType, 1, bytes(""));
      assertTrue(go.goSeniorPool(user));
      uid._burnForTest(user, uidType);
    }
  }

  function testGoSeniorPoolReturnsTrueIfLegacyGoListed(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    gfConfig.addToGoList(user);
    assertTrue(go.goSeniorPool(user));
  }

  function testGoSeniorPoolReturnsFalseIfNotLegacyGoListedAndNoUid(
    address user
  ) public onlyAllowListed(user) {
    assertFalse(go.goSeniorPool(user));
  }

  function testGoSeniorPoolReturnsTrueIfAccountHasZapperRole(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    assertFalse(go.goSeniorPool(user));

    go.initZapperRole();
    go.grantRole(TestConstants.ZAPPER_ROLE, user);

    assertTrue(go.goSeniorPool(user));
  }

  function testGoStillWorksWhenContractIsPaused(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    assertFalse(go.go(user));
    gfConfig.addToGoList(user);
    assertTrue(go.go(user));
    go.pause();
    assertTrue(go.go(user));
  }
}
