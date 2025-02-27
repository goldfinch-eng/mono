// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/interfaces/IERC1155Receiver.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {FuzzingHelper} from "../helpers/FuzzingHelper.t.sol";

import {IProtocolHelper} from "./IProtocolHelper.sol";
import {ProtocolHelper} from "./ProtocolHelper.t.sol";
import {TestERC1155Receiver} from "../helpers/TestERC1155Receiver.t.sol";

abstract contract BaseTest is Test, TestERC1155Receiver {
  using Address for address;

  bytes32 internal constant OWNER_ROLE = keccak256("OWNER_ROLE");
  bytes32 internal constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  bytes32 internal constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

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
    protocol = IProtocolHelper(new ProtocolHelper(vm, GF_OWNER, TREASURY));

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
    fuzzHelper.exclude(address(protocol.gfConfig()));
    // Forge DefaultTestContract 🙄
    fuzzHelper.exclude(0xb4c79daB8f259C7Aee6E5b2Aa729821864227e84);
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

  /**
   * @notice If your test deploys a contract with dynamically linked libs, then there's no easy way to
   * get the addresses at which the libs were deployed. To avoid triggering an accidental "ERC1155: transfer to non-ERC1155Receiver"
   * error by minting to the lib address, this is an additional check you can put in your test:
   *
   * vm.assume(fuzzHelper.isAllowed(_address) && isUidMintable(_address));
   */
  function isUidMintable(address _address) internal view returns (bool) {
    // This was removed in this version: https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/076d90016af6bf960d2c2470ef644135626658c3/CHANGELOG.md?plain=1#L130
    // No replacement was given in the Changelog. Not sure if this will be helpful context, so just commenting out for now.
    // bool isEoa = !_address.isContract();
    // if (isEoa) {
    //   return true;
    // }

    try IERC165(_address).supportsInterface(type(IERC1155Receiver).interfaceId) returns (
      bool support
    ) {
      return support;
    } catch {
      return false;
    }
  }

  function usdcVal(uint256 amount) internal pure returns (uint256) {
    return amount * 10 ** TestConstants.USDC_DECIMALS;
  }

  function thresholdUsdc() internal pure returns (uint256) {
    // Half a cent
    return usdcVal(1) / 200;
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
  function boundUint128(uint128 x, uint128 min, uint128 max) internal pure returns (uint128) {
    return uint128(bound(uint256(x), uint256(min), uint256(max)));
  }

  function assertZero(uint256 x) internal pure {
    assertEq(x, 0);
  }

  function assertZero(uint256 x, string memory message) internal pure {
    assertEq(x, 0, message);
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
