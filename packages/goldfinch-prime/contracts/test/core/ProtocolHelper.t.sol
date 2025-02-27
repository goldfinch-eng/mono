// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Vm} from "forge-std/Vm.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";

import {TestConstants} from "./TestConstants.t.sol";

import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {ConfigHelper} from "../../protocol/core/ConfigHelper.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import "forge-std/Test.sol";

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IERC20} from "../../interfaces/IERC20.sol";
import {TestERC20} from "../TestERC20.sol";

contract ProtocolHelper is IProtocolHelper {
  GoldfinchConfig internal _gfConfig;
  using ConfigHelper for GoldfinchConfig;

  IERC20 internal _usdc;

  constructor(Vm vm, address gfOwner, address treasury) {
    vm.assume(gfOwner != address(0));
    vm.assume(treasury != address(0));
    vm.startPrank(gfOwner);

    _usdc = IERC20(address(new TestERC20(type(uint256).max, uint8(TestConstants.USDC_DECIMALS))));

    _gfConfig = new GoldfinchConfig();
    _gfConfig.initialize(gfOwner);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.USDC), address(_usdc));
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.ProtocolAdmin), gfOwner);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.TreasuryReserve), treasury);

    vm.stopPrank();
  }

  function gfConfig() external override view returns (IGoldfinchConfig) {
    return IGoldfinchConfig(address(_gfConfig));
  }

  function usdc() external override view returns (IERC20) {
    return IERC20(address(_usdc));
  }
}
