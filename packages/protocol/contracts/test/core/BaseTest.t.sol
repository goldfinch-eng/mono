// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {TestERC20} from "../../test/TestERC20.sol";
import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {TranchingLogic} from "../../protocol/core/TranchingLogic.sol";
import {Fidu} from "../../protocol/core/Fidu.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {FuzzingHelper} from "../helpers/FuzzingHelper.t.sol";

abstract contract BaseTest is Test {
  using Strings for uint256;

  address internal constant GF_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2; // random address

  address internal constant TREASURY = 0xE57D6a0996813AA066ab8F1328DaCaff761db5D7; // random address

  // stack of active pranks
  address[] private _pranks;

  GoldfinchConfig internal gfConfig;

  GoldfinchFactory internal gfFactory;

  TestERC20 internal usdc;

  Fidu internal fidu;

  FuzzingHelper internal fuzzHelper = new FuzzingHelper();

  function setUp() public virtual {
    _startImpersonation(GF_OWNER);

    usdc = new TestERC20(type(uint256).max, uint8(TestConstants.USDC_DECIMALS));

    gfConfig = new GoldfinchConfig();
    gfConfig.initialize(GF_OWNER);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.USDC), address(usdc));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.ProtocolAdmin), GF_OWNER);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.TreasuryReserve), TREASURY);

    // Deploy factory
    gfFactory = new GoldfinchFactory();
    gfFactory.initialize(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.GoldfinchFactory), address(gfFactory));

    fidu = new Fidu();
    fidu.__initialize__(GF_OWNER, "Fidu", "FIDU", gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Fidu), address(fidu));

    excludeAddresses();

    _stopImpersonation();
  }

  function excludeAddresses() private {
    fuzzHelper.exclude(address(0));
    fuzzHelper.exclude(address(usdc));
    fuzzHelper.exclude(GF_OWNER);
    fuzzHelper.exclude(TREASURY);
    fuzzHelper.exclude(address(gfFactory));
    fuzzHelper.exclude(address(fidu));
    fuzzHelper.exclude(address(gfConfig));
    // Forge VM
    fuzzHelper.exclude(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    // Forge Create2Deployer
    fuzzHelper.exclude(0x4e59b44847b379578588920cA78FbF26c0B4956C);
  }

  /// @notice Execute a function body with msg.sender == `sender`
  modifier impersonating(address sender) {
    _startImpersonation(sender);
    _;
    _stopImpersonation();
  }

  /// @notice Stop the current prank and, push the `sender` prank onto the prank stack,
  /// and start the prank for `sender`
  function _startImpersonation(address sender) internal {
    if (_pranks.length > 0) {
      vm.stopPrank();
    }
    _pranks.push(sender);
    vm.startPrank(sender);
  }

  /// @notice Stop the current prank and pop it off the prank stack. If a previous
  /// prank was stopped by this impersonation, then resume it
  function _stopImpersonation() internal {
    vm.stopPrank();
    _pranks.pop();
    if (_pranks.length > 0) {
      vm.startPrank(_pranks[_pranks.length - 1]);
    }
  }

  function usdcVal(uint256 amount) internal view returns (uint256) {
    return amount * 10**TestConstants.USDC_DECIMALS;
  }

  function fundAddress(address addressToFund, uint256 amount) public impersonating(GF_OWNER) {
    usdc.transfer(addressToFund, amount);
  }

  modifier filterAddress(address _address) {
    vm.assume(fuzzHelper.isAllowed(_address));
    _;
  }

  modifier assume(bool stmt) {
    vm.assume(stmt);
    _;
  }
}
