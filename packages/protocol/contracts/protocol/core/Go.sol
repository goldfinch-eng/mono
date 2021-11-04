// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../interfaces/IGo.sol";
import "../../interfaces/IUniqueIdentity0612.sol";

contract Go is IGo, BaseUpgradeablePausable {
  address public override uniqueIdentity;

  using SafeMath for uint256;

  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  uint256 public constant ID_VERSION_0 = 0;
  uint256 public constant ID_VERSION_1 = 1;
  uint256 public constant ID_VERSION_2 = 2;
  uint256 public constant ID_VERSION_3 = 3;
  uint256 public constant ID_VERSION_4 = 4;
  uint256 public constant ID_VERSION_5 = 5;
  uint256 public constant ID_VERSION_6 = 6;
  uint256 public constant ID_VERSION_7 = 7;
  uint256 public constant ID_VERSION_8 = 8;
  uint256 public constant ID_VERSION_9 = 9;
  uint256 public constant ID_VERSION_10 = 10;
  uint256[] public versions = [
    ID_VERSION_0,
    ID_VERSION_1,
    ID_VERSION_2,
    ID_VERSION_3,
    ID_VERSION_4,
    ID_VERSION_5,
    ID_VERSION_6,
    ID_VERSION_7,
    ID_VERSION_8,
    ID_VERSION_9,
    ID_VERSION_10
  ];

  event GoldfinchConfigUpdated(address indexed who, address configAddress);

  function initialize(
    address owner,
    GoldfinchConfig _config,
    address _uniqueIdentity
  ) public initializer {
    require(
      owner != address(0) && address(_config) != address(0) && _uniqueIdentity != address(0),
      "Owner and config and UniqueIdentity addresses cannot be empty"
    );
    __BaseUpgradeablePausable__init(owner);
    config = _config;
    uniqueIdentity = _uniqueIdentity;
  }

  function updateGoldfinchConfig() external override onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
    emit GoldfinchConfigUpdated(msg.sender, address(config));
  }

  /**
   * @notice Returns whether the provided account is go-listed for use of the Goldfinch protocol.
   * This status is defined as: whether `balanceOf(account, id)` on the UniqueIdentity
   * contract is non-zero (where `id` is a supported token id on UniqueIdentity), falling back to the
   * account's status on the legacy go-list maintained on GoldfinchConfig.
   * @param account The account whose go status to obtain
   * @return The account's go status
   */
  function go(address account) public view override returns (bool) {
    require(account != address(0), "Zero address is not go-listed");
    address[] memory accounts = new address[](1);
    accounts[0] = account;
    uint256[] memory balances = IUniqueIdentity0612(uniqueIdentity).balanceOfBatch(accounts, versions);
    for (uint256 i = 0; i < balances.length; ++i) {
      if (balances[i] > 0) {
        return true;
      }
    }
    return config.goList(account);
  }

  function go(address account, uint256[] memory onlyVersions) public view override returns (bool) {
    require(account != address(0), "Zero address is not go-listed");
    address[] memory accounts = new address[](1);
    accounts[0] = account;
    uint256[] memory balances = IUniqueIdentity0612(uniqueIdentity).balanceOfBatch(accounts, onlyVersions);
    for (uint256 i = 0; i < balances.length; ++i) {
      if (balances[i] > 0) {
        return true;
      }
    }
    return config.goList(account);
  }
}
