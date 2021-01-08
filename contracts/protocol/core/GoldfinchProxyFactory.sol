// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./BaseUpgradeablePausable.sol";
import "./GoldfinchConfig.sol";
import "./GoldfinchProxy.sol";
import "../periphery/Borrower.sol";

/**
 * @title GoldfinchProxyFactory
 * @notice Contract that allows us to follow the minimal proxy pattern for creating CreditLines.
 *  This saves us gas, and lets us easily swap out the CreditLine implementaton.
 * @author Goldfinch
 */

contract GoldfinchProxyFactory is BaseUpgradeablePausable {
  GoldfinchConfig public config;

  // THIS IS TEMPORARY. REMOVE ONCE WE ARE USING CREATE2 CALCULATED ADDRESS
  event BorrowerCreated(address indexed borrower, address indexed owner);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function createCreditLine(bytes calldata _data, address borrower) external returns (address) {
    GoldfinchProxy creditLineProxy = createProxyWithSalt(
      address(config),
      uint256(ConfigOptions.Addresses.CreditLineImplementation),
      _data,
      keccak256(abi.encodePacked(borrower, block.number))
    );
    return address(creditLineProxy);
  }

  /**
   * @notice Allows anyone to create a Borrower contract instance
   * @param owner The address that will own the new Borrower instance
   */
  function createBorrower(address owner) external returns (address) {
    GoldfinchProxy borrowerProxy = createProxyWithSalt(
      address(config),
      uint256(ConfigOptions.Addresses.BorrowerImplementation),
      "",
      keccak256(abi.encodePacked(owner))
    );
    Borrower(address(borrowerProxy)).initialize(owner, config);
    // THIS IS TEMPORARY. REMOVE ONCE WE ARE USING CREATE2 CALCULATED ADDRESS
    emit BorrowerCreated(address(borrowerProxy), owner);
    return address(borrowerProxy);
  }

  // solhint-disable-next-line max-line-length
  // These following methods are based on https://github.com/gnosis/safe-contracts/blob/94f9b9083790495f67b661bfa93b06dcba2d3949/contracts/proxies/GoldfinchProxyFactory.sol
  // The main difference is an additional layer of indirection via the config contract to retrieve the mastercopy.
  // This allows us to upgrade all implementations just by changing the config contract. The tradeoff is increased gas
  // costs on every function call that uses this proxy

  function deployProxyWithSalt(
    address _configAddress,
    uint256 _configMasterCopyIndex,
    bytes memory initializer,
    bytes32 salt
  ) internal returns (GoldfinchProxy proxy) {
    bytes memory deploymentData = abi.encodePacked(
      type(GoldfinchProxy).creationCode,
      uint256(_configAddress),
      _configMasterCopyIndex
    );
    // solhint-disable-next-line no-inline-assembly
    assembly {
      proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
    }
    require(address(proxy) != address(0), "Create2 call failed");
  }

  function createProxyWithSalt(
    address _configAddress,
    uint256 _configMasterCopyIndex,
    bytes memory initializer,
    bytes32 salt
  ) public returns (GoldfinchProxy proxy) {
    proxy = deployProxyWithSalt(_configAddress, _configMasterCopyIndex, initializer, salt);
    if (initializer.length > 0)
      // solhint-disable-next-line no-inline-assembly
      assembly {
        if eq(call(gas(), proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0), 0) {
          revert(0, 0)
        }
      }
  }
}
