// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Go} from "../../../protocol/core/Go.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {ITestUniqueIdentity0612} from "../../../test/ITestUniqueIdentity0612.t.sol";
import {BaseTest} from "../BaseTest.t.sol";

contract GoBaseTest is BaseTest {
  GoldfinchConfig internal gfConfig;
  Go internal go;
  ITestUniqueIdentity0612 internal uniqueIdentity;

  function setUp() public virtual override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    uniqueIdentity = ITestUniqueIdentity0612(deployCode("TestUniqueIdentity.sol"));
    uniqueIdentity.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uniqueIdentity.setSupportedUIDTypes(supportedUids, supportedUidValues);

    go = new Go();
    go.initialize(GF_OWNER, gfConfig, address(uniqueIdentity));

    fuzzHelper.exclude(address(gfConfig));
    fuzzHelper.exclude(address(go));
    fuzzHelper.exclude(address(uniqueIdentity));
    fuzzHelper.exclude(address(protocol.stakingRewards()));

    _stopImpersonation();
  }
}
