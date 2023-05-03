// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {BaseTest} from "../BaseTest.t.sol";

contract GoldfinchConfigBaseTest is BaseTest {
  GoldfinchConfig internal gfConfig;

  function setUp() public virtual override {
    gfConfig = new GoldfinchConfig();
    gfConfig.initialize(GF_OWNER);
  }
}
