// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../core/BaseUpgradeablePausable.sol";
import "../core/ConfigHelper.sol";
import "../core/CreditLine.sol";
import "../core/GoldfinchConfig.sol";
import "../../interfaces/IBase.sol";

/**
 * @title V2 Migrator Contract
 * @notice This is a one-time use contract solely for the purpose of migrating from our V1
 *  to our V2 architecture. It will be temporarily granted authority from the Goldfinch governance,
 *  and then revokes it's own authority and transfers it back to governance.
 * @author Goldfinch
 */

contract V2Migrator is BaseUpgradeablePausable {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant GO_LISTER_ROLE = keccak256("GO_LISTER_ROLE");
  using SafeMath for uint256;

  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  mapping(address => address) public borrowerContracts;
  event CreditLineMigrated(address indexed owner, address indexed clToMigrate, address newCl, address tranchedPool);

  function initialize(address owner, address _config) external initializer {
    require(owner != address(0) && _config != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = GoldfinchConfig(_config);
  }

  function migratePhase1(GoldfinchConfig newConfig, address[] calldata newDeployments) external onlyAdmin {
    pauseEverything();
    migrateToNewConfig(newConfig);
    upgradeImplementations(newDeployments);
    migrateToSeniorPool(newConfig);
  }

  function migrateCreditLines(
    GoldfinchConfig newConfig,
    address[][] calldata creditLinesToMigrate,
    uint256[][] calldata migrationData
  ) external onlyAdmin {
    IBase creditDesk = IBase(newConfig.creditDeskAddress());
    IGoldfinchFactory factory = newConfig.getGoldfinchFactory();
    for (uint256 i = 0; i < creditLinesToMigrate.length; i++) {
      address[] calldata clData = creditLinesToMigrate[i];
      uint256[] calldata data = migrationData[i];
      address clAddress = clData[0];
      address owner = clData[1];
      address borrowerContract = borrowerContracts[owner];
      if (borrowerContract == address(0)) {
        borrowerContract = factory.createBorrower(owner);
        borrowerContracts[owner] = borrowerContract;
      }
      (address newCl, address pool) = creditDesk.migrateV1CreditLine(
        clAddress,
        borrowerContract,
        data[0],
        data[1],
        data[2],
        data[3],
        data[4],
        data[5]
      );
      emit CreditLineMigrated(owner, clAddress, newCl, pool);
    }
  }

  function bulkAddToGoList(GoldfinchConfig newConfig, address[] calldata members) external onlyAdmin {
    newConfig.bulkAddToGoList(members);
  }

  function closeOutMigration(GoldfinchConfig newConfig) external onlyAdmin {
    IBase fidu = IBase(newConfig.fiduAddress());
    IBase creditDesk = IBase(newConfig.creditDeskAddress());
    IBase oldPool = IBase(newConfig.poolAddress());
    IBase goldfinchFactory = IBase(newConfig.goldfinchFactoryAddress());

    fidu.unpause();
    fidu.renounceRole(MINTER_ROLE, address(this));
    fidu.renounceRole(OWNER_ROLE, address(this));
    fidu.renounceRole(PAUSER_ROLE, address(this));

    creditDesk.renounceRole(OWNER_ROLE, address(this));
    creditDesk.renounceRole(PAUSER_ROLE, address(this));

    oldPool.renounceRole(OWNER_ROLE, address(this));
    oldPool.renounceRole(PAUSER_ROLE, address(this));

    goldfinchFactory.renounceRole(OWNER_ROLE, address(this));
    goldfinchFactory.renounceRole(PAUSER_ROLE, address(this));

    config.renounceRole(PAUSER_ROLE, address(this));

    newConfig.renounceRole(OWNER_ROLE, address(this));
    newConfig.renounceRole(GO_LISTER_ROLE, address(this));

    address goldfinchGovernance = config.protocolAdminAddress();
    uint256 chainId = getChainID();
    if (chainId == 1) {
      require(goldfinchGovernance == address(0xBEb28978B2c755155f20fd3d09Cb37e300A6981f), "Wrong admin address!");
    }
    oldPool.transferOwnership(config.protocolAdminAddress());
    creditDesk.transferOwnership(config.protocolAdminAddress());
    goldfinchFactory.transferOwnership(config.protocolAdminAddress());
    fidu.transferOwnership(config.protocolAdminAddress());
  }

  function pauseEverything() internal {
    IBase(config.creditDeskAddress()).pause();
    IBase(config.poolAddress()).pause();
    IBase(config.fiduAddress()).pause();
  }

  function migrateToNewConfig(GoldfinchConfig newConfig) internal {
    uint256 key = uint256(ConfigOptions.Addresses.GoldfinchConfig);
    config.setAddress(key, address(newConfig));

    IBase(config.creditDeskAddress()).updateGoldfinchConfig();
    IBase(config.poolAddress()).updateGoldfinchConfig();
    IBase(config.fiduAddress()).updateGoldfinchConfig();
    IBase(config.goldfinchFactoryAddress()).updateGoldfinchConfig();

    key = uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds);
    newConfig.setNumber(key, 24 * 60 * 60);

    key = uint256(ConfigOptions.Numbers.TransferRestrictionPeriodInDays);
    newConfig.setNumber(key, 365);
  }

  function upgradeImplementations(address[] calldata newDeployments) public onlyAdmin {
    address poolAddress = newDeployments[0];
    address creditDeskAddress = newDeployments[1];
    address fiduAddress = newDeployments[2];
    address goldfinchFactoryAddress = newDeployments[3];

    bytes calldata data;
    IBase(config.poolAddress()).changeImplementation(poolAddress, data);
    IBase(config.creditDeskAddress()).changeImplementation(creditDeskAddress, data);
    IBase(config.fiduAddress()).changeImplementation(fiduAddress, data);
    IBase(config.goldfinchFactoryAddress()).changeImplementation(goldfinchFactoryAddress, data);
  }

  function migrateToSeniorPool(GoldfinchConfig newConfig) internal {
    IBase(config.fiduAddress()).grantRole(MINTER_ROLE, newConfig.seniorPoolAddress());
    IBase(config.poolAddress()).unpause();
    IBase(newConfig.poolAddress()).migrateToSeniorPool();
  }

  function getChainID() internal pure returns (uint256) {
    uint256 id;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      id := chainid()
    }
    return id;
  }
}
