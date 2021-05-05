// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "../periphery/Borrower.sol";
import "./CreditLine.sol";
import "./DeployHelpers.sol";
import "../../interfaces/ITranchedPool.sol";
import "./ConfigHelper.sol";

/**
 * @title CreditLineFactory
 * @notice Contract that allows us to create other contracts, such as CreditLines and BorrowerContracts
 * @author Goldfinch
 */

contract CreditLineFactory is BaseUpgradeablePausable {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  event BorrowerCreated(address indexed borrower, address indexed owner);
  event PoolCreated(address indexed pool, address indexed owner);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function createCreditLine() external returns (address) {
    CreditLine newCreditLine = new CreditLine();
    return address(newCreditLine);
  }

  /**
   * @notice Allows anyone to create a Borrower contract instance
   * @param owner The address that will own the new Borrower instance
   */
  function createBorrower(address owner) external returns (address) {
    Borrower borrower = new Borrower();
    borrower.initialize(owner, config);
    emit BorrowerCreated(address(borrower), owner);
    return address(borrower);
  }

  function createPool(
    address underwriter,
    address borrower,
    address creditLine,
    uint256 juniorFeePercent
  ) external returns (address) {
    address tranchedPoolImplAddress = config.getAddress(uint256(ConfigOptions.Addresses.TranchedPoolImplementation));
    bytes memory bytecode = DeployHelpers.getMinimalProxyCreationCode(tranchedPoolImplAddress);
    uint256 createdAt = block.timestamp;
    bytes32 salt = keccak256(abi.encodePacked(borrower, createdAt));

    address pool = DeployHelpers.create2Deploy(bytecode, salt);
    ITranchedPool(pool).initialize(underwriter, address(config), creditLine, juniorFeePercent);

    return pool;
  }

  function validPool(address addressToVerify) external view returns (bool) {
    ITranchedPool pool = ITranchedPool(addressToVerify);
    address borrower = pool.creditLine().borrower();
    bytes32 salt = keccak256(abi.encodePacked(borrower, pool.createdAt()));
    // TODO: Pull this from the actual min proxy, not the config, so that we can upgrade
    // without breaking the old pools
    address poolImplAddress = config.tranchedPoolAddress();
    bytes memory creationCode = DeployHelpers.getMinimalProxyCreationCode(poolImplAddress);
    address expectedAddress = DeployHelpers.getCreate2Address(config.creditLineFactoryAddress(), creationCode, salt);
    return expectedAddress == addressToVerify;
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }
}
