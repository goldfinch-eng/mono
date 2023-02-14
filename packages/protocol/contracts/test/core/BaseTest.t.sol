// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {FuzzingHelper} from "../helpers/FuzzingHelper.t.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";

abstract contract BaseTest is Test {
  address internal constant PROTOCOL_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2;
  address internal constant GF_OWNER = 0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2; // random address

  address internal constant TREASURY = 0xE57D6a0996813AA066ab8F1328DaCaff761db5D7; // random address

  struct Impersonation {
    address sender;
    address origin;
  }
  // stack of active pranks
  Impersonation[] private _pranks;

  IProtocolHelper internal protocol;

  FuzzingHelper internal fuzzHelper = new FuzzingHelper();

  function setUp() public virtual {
    // We use deployCode and cast to an interface so that BaseTest can be used by both 0.6.x and 0.8.x test files.
    protocol = IProtocolHelper(
      deployCode(
        "./artifacts/ProtocolHelper.t.sol/ProtocolHelper.json",
        abi.encode(vm, GF_OWNER, TREASURY)
      )
    );

    excludeAddresses();
  }

  function excludeAddresses() private {
    fuzzHelper.exclude(address(this));
    fuzzHelper.exclude(address(fuzzHelper));
    fuzzHelper.exclude(address(0));
    fuzzHelper.exclude(address(protocol));
    fuzzHelper.exclude(address(protocol.usdc()));
    fuzzHelper.exclude(GF_OWNER);
    fuzzHelper.exclude(TREASURY);
    fuzzHelper.exclude(address(protocol.gfFactory()));
    fuzzHelper.exclude(address(protocol.fidu()));
    fuzzHelper.exclude(address(protocol.gfConfig()));
    fuzzHelper.exclude(address(protocol.stakingRewards()));
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
    _startImpersonation(sender, address(0));
  }

  function _startImpersonation(address sender, address origin) internal {
    if (_pranks.length > 0) {
      vm.stopPrank();
    }
    _pranks.push(Impersonation(sender, origin));
    if (origin != address(0)) {
      vm.startPrank(sender, origin);
    } else {
      vm.startPrank(sender);
    }
  }

  /// @notice Stop the current prank and pop it off the prank stack. If a previous
  /// prank was stopped by this impersonation, then resume it
  function _stopImpersonation() internal {
    vm.stopPrank();
    _pranks.pop();
    if (_pranks.length > 0) {
      Impersonation memory impersonation = _pranks[_pranks.length - 1];
      if (impersonation.origin != address(0)) {
        vm.startPrank(impersonation.sender, impersonation.origin);
      } else {
        vm.startPrank(impersonation.sender);
      }
    }
  }

  function usdcVal(uint256 amount) internal pure returns (uint256) {
    return amount * 10 ** TestConstants.USDC_DECIMALS;
  }

  function thresholdUsdc() internal pure returns (uint256) {
    // Half a cent
    return usdcVal(1) / 200;
  }

  function fiduVal(uint256 amount) internal pure returns (uint256) {
    return amount * 10 ** TestConstants.FIDU_DECIMALS;
  }

  function thresholdFidu() internal pure returns (uint256) {
    // Half a cent (of fidu)
    return fiduVal(1) / 200;
  }

  function fundAddress(address addressToFund, uint256 amount) internal impersonating(GF_OWNER) {
    protocol.usdc().transfer(addressToFund, amount);
  }

  function grantRole(
    address gfContract,
    bytes32 role,
    address recipient
  ) internal impersonating(GF_OWNER) {
    (bool success, ) = gfContract.call(
      abi.encodeWithSignature("grantRole(bytes32,address)", role, recipient)
    );
    require(success, "Failed to grant role");
  }

  /**
   * @dev Wraps bound in uint128 cast. Better to be declarative than rely on implicit conversions.
   */
  function boundUint128(uint128 x, uint128 min, uint128 max) internal returns (uint128) {
    return uint128(bound(x, min, max));
  }

  function assertZero(uint256 x) internal {
    assertEq(x, 0);
  }

  function assertZero(uint256 x, string memory msgToDisplay) internal {
    assertEq(x, 0, msgToDisplay);
  }

  modifier onlyAllowListed(address _address) {
    vm.assume(fuzzHelper.isAllowed(_address));
    _;
  }

  modifier assume(bool stmt) {
    vm.assume(stmt);
    _;
  }

  modifier validPrivateKey(uint256 key) {
    // valid private key space is from [1, secp256k1n − 1]
    vm.assume(key > 0);
    vm.assume(key <= uint256(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141));
    _;
  }
}
