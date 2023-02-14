// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Vm} from "forge-std/Vm.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";

import {TestConstants} from "./TestConstants.t.sol";

import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {Fidu} from "../../protocol/core/Fidu.sol";
import {StakingRewards} from "../../rewards/StakingRewards.sol";
import {IStakingRewards} from "../../interfaces/IStakingRewards.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import "forge-std/Test.sol";

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IFidu} from "../../interfaces/IFidu.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

contract ProtocolHelper is IProtocolHelper, Test {
  GoldfinchConfig internal _gfConfig;
  GoldfinchFactory internal _gfFactory;
  Fidu internal _fidu;
  StakingRewards internal _stakingRewards;
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

    _fidu = new Fidu();
    _fidu.__initialize__(gfOwner, "Fidu", "FIDU", _gfConfig);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.Fidu), address(_fidu));

    _stakingRewards = new StakingRewards();
    _stakingRewards.__initialize__(gfOwner, _gfConfig);
    _gfConfig.setAddress(uint256(ConfigOptions.Addresses.StakingRewards), address(_stakingRewards));

    vm.stopPrank();
  }

  function gfConfig() external override returns (IGoldfinchConfig) {
    return IGoldfinchConfig(address(_gfConfig));
  }

  function fidu() external override returns (IERC20) {
    return IERC20(address(_fidu));
  }

  function gfFactory() external override returns (IGoldfinchFactory) {
    return IGoldfinchFactory(address(_gfFactory));
  }

  function stakingRewards() external override returns (IStakingRewards) {
    return IStakingRewards(address(_stakingRewards));
  }

  function usdc() external override returns (IERC20) {
    return IERC20(address(_usdc));
  }
}
