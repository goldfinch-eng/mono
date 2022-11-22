// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

import "forge-std/Test.sol";

import {BaseTest} from "./BaseTest.t.sol";

/// This is a smoke test to ensure that BaseTest works for tests written in 0.8.16.
/// This test can be removed once tests written in 0.8.16 have been merged into main.
contract Test08x is BaseTest {
  function setUp() public override {
    super.setUp();
  }

  // This test does nothing, but will fail during compilation if any of the interfaces
  // used do not support solidity 0.8.x.
  function test08x() public {
    IGoldfinchConfig gfConfig = protocol.gfConfig();
    IGoldfinchFactory gfFactory = protocol.gfFactory();
    IERC20 fidu = protocol.fidu();
    IERC20 usdc = protocol.usdc();
    assertTrue(true);
  }
}
