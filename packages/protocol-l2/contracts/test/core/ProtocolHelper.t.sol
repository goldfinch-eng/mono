// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Vm} from "forge-std/Vm.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";

import {TestConstants} from "./TestConstants.t.sol";

import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import "forge-std/Test.sol";

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

contract ProtocolHelper is IProtocolHelper, Test {
  GoldfinchConfig internal _gfConfig;
  GoldfinchFactory internal _gfFactory;
  IERC20 internal _usdc;

  constructor(Vm vm, address gfOwner, address treasury) public {
    vm.assume(gfOwner != address(0));
    vm.assume(treasury != address(0));
    vm.startPrank(gfOwner);

    _usdc = IERC20(
      deployCode("TestERC20.sol", abi.encode(type(uint256).max, uint8(TestConstants.USDC_DECIMALS)))
    );

    _gfConfig = new GoldfinchConfig();
    _gfConfig.initialize(gfOwner);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.USDC), address(_usdc));
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.ProtocolAdmin), gfOwner);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.TreasuryReserve), treasury);

    // Deploy factory
    _gfFactory = new GoldfinchFactory();
    _gfFactory.initialize(gfOwner, _gfConfig);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.GoldfinchFactory), address(_gfFactory));

    vm.stopPrank();
  }

  function gfConfig() external override returns (IGoldfinchConfig) {
    return IGoldfinchConfig(address(_gfConfig));
  }

  function gfFactory() external override returns (IGoldfinchFactory) {
    return IGoldfinchFactory(address(_gfFactory));
  }

  function usdc() external override returns (IERC20) {
    return IERC20(address(_usdc));
  }
}
