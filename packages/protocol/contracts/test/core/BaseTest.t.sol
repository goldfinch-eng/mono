// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {FuzzingHelper} from "../helpers/FuzzingHelper.t.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";

abstract contract BaseTest is Test {
  address internal constant GF_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2; // random address

  address internal constant TREASURY = 0xE57D6a0996813AA066ab8F1328DaCaff761db5D7; // random address

  // stack of active pranks
  address[] private _pranks;

  IProtocolHelper internal protocol;

  FuzzingHelper internal fuzzHelper = new FuzzingHelper();

  function setUp() public virtual {
    // We use deployCode and cast to an interface so that BaseTest can be used by both 0.6.x and 0.8.x test files.
    protocol = IProtocolHelper(
      deployCode("./artifacts/ProtocolHelper.t.sol/ProtocolHelper.json", abi.encode(vm, GF_OWNER, TREASURY))
    );

    excludeAddresses();
  }

  function excludeAddresses() private {
    fuzzHelper.exclude(address(0));
    fuzzHelper.exclude(address(protocol.usdc()));
    fuzzHelper.exclude(GF_OWNER);
    fuzzHelper.exclude(TREASURY);
    fuzzHelper.exclude(address(protocol.gfFactory()));
    fuzzHelper.exclude(address(protocol.fidu()));
    fuzzHelper.exclude(address(protocol.gfConfig()));
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
    protocol.usdc().transfer(addressToFund, amount);
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
