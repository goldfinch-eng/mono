// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Go} from "../../../protocol/core/Go.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {TestUniqueIdentity} from "../../../test/TestUniqueIdentity.sol";
import {BaseTest} from "../BaseTest.t.sol";

contract GoBaseTest is BaseTest {
  GoldfinchConfig internal gfConfig;
  Go internal go;
  TestUniqueIdentity internal uid;

  function setUp() public virtual override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    uid = new TestUniqueIdentity();
    uid.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);

    go = new Go();
    go.initialize(GF_OWNER, gfConfig, uid);

    fuzzHelper.exclude(address(gfConfig));
    fuzzHelper.exclude(address(go));
    fuzzHelper.exclude(address(uid));
    fuzzHelper.exclude(address(this));

    _stopImpersonation();
  }
}
