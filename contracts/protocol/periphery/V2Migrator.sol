// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../core/BaseUpgradeablePausable.sol";
import "../core/ConfigHelper.sol";
import "../core/CreditLine.sol";
import "../core/GoldfinchConfig.sol";
import "../../interfaces/IMigrate.sol";

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

  function migratePhase1(GoldfinchConfig newConfig) external onlyAdmin {
    pauseEverything();
    migrateToNewConfig(newConfig);
    migrateToSeniorPool(newConfig);
  }

  function migrateCreditLines(
    GoldfinchConfig newConfig,
    address[][] calldata creditLinesToMigrate,
    uint256[][] calldata migrationData
  ) external onlyAdmin {
    IMigrate creditDesk = IMigrate(newConfig.creditDeskAddress());
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
        data[4]
      );
      emit CreditLineMigrated(owner, clAddress, newCl, pool);
    }
  }

  function bulkAddToGoList(GoldfinchConfig newConfig, address[] calldata members) external onlyAdmin {
    newConfig.bulkAddToGoList(members);
  }

  function pauseEverything() internal {
    IMigrate(config.creditDeskAddress()).pause();
    IMigrate(config.poolAddress()).pause();
    IMigrate(config.fiduAddress()).pause();
  }

  function migrateToNewConfig(GoldfinchConfig newConfig) internal {
    uint256 key = uint256(ConfigOptions.Addresses.GoldfinchConfig);
    config.setAddress(key, address(newConfig));

    IMigrate(config.creditDeskAddress()).updateGoldfinchConfig();
    IMigrate(config.poolAddress()).updateGoldfinchConfig();
    IMigrate(config.fiduAddress()).updateGoldfinchConfig();
    IMigrate(config.goldfinchFactoryAddress()).updateGoldfinchConfig();

    key = uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds);
    newConfig.setNumber(key, 24 * 60 * 60);

    key = uint256(ConfigOptions.Numbers.TransferRestrictionPeriodInDays);
    newConfig.setNumber(key, 365);

    key = uint256(ConfigOptions.Numbers.LeverageRatio);
    // 1e18 is the LEVERAGE_RATIO_DECIMALS
    newConfig.setNumber(key, 3 * 1e18);
  }

  function upgradeImplementations(GoldfinchConfig _config, address[] calldata newDeployments) public {
    address newPoolAddress = newDeployments[0];
    address newCreditDeskAddress = newDeployments[1];
    address newFiduAddress = newDeployments[2];
    address newGoldfinchFactoryAddress = newDeployments[3];

    bytes memory data;
    IMigrate pool = IMigrate(_config.poolAddress());
    IMigrate creditDesk = IMigrate(_config.creditDeskAddress());
    IMigrate fidu = IMigrate(_config.fiduAddress());
    IMigrate goldfinchFactory = IMigrate(_config.goldfinchFactoryAddress());

    // Upgrade implementations
    pool.changeImplementation(newPoolAddress, data);
    creditDesk.changeImplementation(newCreditDeskAddress, data);
    fidu.changeImplementation(newFiduAddress, data);
    goldfinchFactory.changeImplementation(newGoldfinchFactoryAddress, data);
  }

  function migrateToSeniorPool(GoldfinchConfig newConfig) internal {
    IMigrate(config.fiduAddress()).grantRole(MINTER_ROLE, newConfig.seniorPoolAddress());
    IMigrate(config.poolAddress()).unpause();
    IMigrate(newConfig.poolAddress()).migrateToSeniorPool();
  }

  function closeOutMigration(GoldfinchConfig newConfig) external onlyAdmin {
    IMigrate fidu = IMigrate(newConfig.fiduAddress());
    IMigrate creditDesk = IMigrate(newConfig.creditDeskAddress());
    IMigrate oldPool = IMigrate(newConfig.poolAddress());
    IMigrate goldfinchFactory = IMigrate(newConfig.goldfinchFactoryAddress());

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
    config.renounceRole(OWNER_ROLE, address(this));

    newConfig.renounceRole(OWNER_ROLE, address(this));
    newConfig.renounceRole(PAUSER_ROLE, address(this));
    newConfig.renounceRole(GO_LISTER_ROLE, address(this));
  }
}
