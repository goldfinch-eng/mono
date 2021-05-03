// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";

/**
 * @title DeployHelpers
 * @notice A convenience library for accessing generic functions related to on-chain deployment,
 *  such as create2 deployments, calculating create2 addresses, and minimal proxies.
 * @author Goldfinch
 */

library DeployHelpers {
  function getMinimalProxyCreationCode(address logic) internal pure returns (bytes memory) {
    bytes10 creation = 0x3d602d80600a3d3981f3;
    bytes10 prefix = 0x363d3d373d3d3d363d73;
    bytes20 targetBytes = bytes20(logic);
    bytes15 suffix = 0x5af43d82803e903d91602b57fd5bf3;
    return abi.encodePacked(creation, prefix, targetBytes, suffix);
  }

  function getCreate2Address(
    address deployer,
    bytes memory bytecode,
    bytes32 salt
  ) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, keccak256(bytecode)));

    // NOTE: cast last 20 bytes of hash to address
    return address(uint160(uint256(hash)));
  }

  function create2Deploy(bytes memory bytecode, bytes32 salt) internal returns (address) {
    address deployment;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      deployment := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    return deployment;
  }
}
