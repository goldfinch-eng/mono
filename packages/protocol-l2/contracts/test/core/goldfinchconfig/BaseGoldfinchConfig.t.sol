// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {BaseTest} from "../BaseTest.t.sol";

contract GoldfinchConfigBaseTest is BaseTest {
  GoldfinchConfig internal gfConfig;

  function setUp() public virtual override {
    gfConfig = new GoldfinchConfig();
    gfConfig.initialize(GF_OWNER);
  }
}
