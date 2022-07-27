// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {TestERC20} from "../../test/TestERC20.sol";
import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import {TestConstants} from "./TestConstants.sol";

abstract contract BaseTest is Test {
  address internal constant PROTOCOL_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2;

  GoldfinchConfig internal goldfinchConfig;
  TestERC20 internal usdc;

  function setUp() public virtual {
    vm.startPrank(PROTOCOL_OWNER);

    usdc = new TestERC20(type(uint256).max, uint8(TestConstants.USDC_DECIMALS));

    goldfinchConfig = new GoldfinchConfig();
    goldfinchConfig.initialize(PROTOCOL_OWNER);
    goldfinchConfig.setAddress(uint256(ConfigOptions.Addresses.USDC), address(usdc));

    vm.stopPrank();
  }

  modifier withMsgSender(address sender) {
    vm.startPrank(sender);
    _;
    vm.stopPrank();
  }
}
