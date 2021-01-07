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

  function createCreditLine(bytes calldata _data) external returns (address) {
    GoldfinchProxy creditLineProxy = createProxyWithNonce(
      address(config),
      uint256(ConfigOptions.Addresses.CreditLineImplementation),
      _data,
      block.number
    );
    return address(creditLineProxy);
  }

  /**
 * @notice Allows anyone to create a Borrower contract instance
 * @param owner The address that will own the new Borrower instance
 */
  function createBorrower(address owner) external returns (address) {
    Borrower borrower = new Borrower();
    borrower.initialize(owner, config);
    // THIS IS TEMPORARY. REMOVE ONCE WE ARE USING CREATE2 CALCULATED ADDRESS
    emit BorrowerCreated(address(borrower), owner);
    return address(borrower);
  }

  // solhint-disable-next-line max-line-length
  // These following methods are based on https://github.com/gnosis/safe-contracts/blob/94f9b9083790495f67b661bfa93b06dcba2d3949/contracts/proxies/GoldfinchProxyFactory.sol
  // The main difference is an additional layer of indirection via the config contract to retrieve the mastercopy.
  // This allows us to upgrade all implementations just by changing the config contract. The tradeoff is increased gas
  // costs on every function call that uses this proxy

  function deployProxyWithNonce(
    address _configAddress,
    uint256 _configMasterCopyIndex,
    bytes memory initializer,
    uint256 saltNonce
  ) internal returns (GoldfinchProxy proxy) {
    // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just
    // concatenating it
    bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    bytes memory deploymentData = abi.encodePacked(
      type(GoldfinchProxy).creationCode,
      uint256(_configAddress),
      _configMasterCopyIndex
    );
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
    }
    require(address(proxy) != address(0), "Create2 call failed");
  }

  function createProxyWithNonce(
    address _configAddress,
    uint256 _configMasterCopyIndex,
    bytes memory initializer,
    uint256 saltNonce
  ) public returns (GoldfinchProxy proxy) {
    proxy = deployProxyWithNonce(_configAddress, _configMasterCopyIndex, initializer, saltNonce);
    if (initializer.length > 0)
      // solium-disable-next-line security/no-inline-assembly
      assembly {
        if eq(call(gas(), proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0), 0) {
          revert(0, 0)
        }
      }
  }
}
