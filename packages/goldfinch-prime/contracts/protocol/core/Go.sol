// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";
import {IGo} from "../../interfaces/IGo.sol";
import {IUniqueIdentity} from "../../interfaces/IUniqueIdentity.sol";

contract Go is IGo, BaseUpgradeablePausable {
  IUniqueIdentity public override uniqueIdentity;

  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  uint256[11] public allIdTypes;
  event GoldfinchConfigUpdated(address indexed who, address configAddress);

  function initialize(
    address owner,
    GoldfinchConfig _config,
    IUniqueIdentity _uniqueIdentity
  ) public initializer {
    require(
      owner != address(0) &&
        address(_config) != address(0) &&
        address(_uniqueIdentity) != address(0),
      "Owner and config and UniqueIdentity addresses cannot be empty"
    );
    __BaseUpgradeablePausable__init(owner, _config);
    _performUpgrade();
    config = _config;
    uniqueIdentity = _uniqueIdentity;
  }

  function performUpgrade() external onlyAdmin {
    return _performUpgrade();
  }

  function _performUpgrade() internal {
    allIdTypes[0] = ID_TYPE_0;
    allIdTypes[1] = ID_TYPE_1;
    allIdTypes[2] = ID_TYPE_2;
    allIdTypes[3] = ID_TYPE_3;
    allIdTypes[4] = ID_TYPE_4;
    allIdTypes[5] = ID_TYPE_5;
    allIdTypes[6] = ID_TYPE_6;
    allIdTypes[7] = ID_TYPE_7;
    allIdTypes[8] = ID_TYPE_8;
    allIdTypes[9] = ID_TYPE_9;
    allIdTypes[10] = ID_TYPE_10;
  }

  /**
   * @notice Returns whether the provided account is:
   * 1. go-listed for use of the Goldfinch protocol for any of the provided UID token types
   * 2. is allowed to act on behalf of the go-listed EOA initiating this transaction
   * Go-listed is defined as: whether `balanceOf(account, id)` on the UniqueIdentity
   * contract is non-zero (where `id` is a supported token id on UniqueIdentity).
   * @dev If tx.origin is 0x0 (e.g. in blockchain explorers such as Etherscan) this function will
   *      throw an error if the account is not go listed.
   * @param account The account whose go status to obtain
   * @param onlyIdTypes Array of id types to check balances
   * @return The account's go status
   */
  function goOnlyIdTypes(
    address account,
    uint256[] memory onlyIdTypes
  ) public view override returns (bool) {
    require(account != address(0), "Zero address is not go-listed");

    for (uint256 i = 0; i < onlyIdTypes.length; ++i) {
      uint256 idType = onlyIdTypes[i];

      uint256 accountIdBalance = uniqueIdentity.balanceOf(account, idType);
      if (accountIdBalance > 0) {
        return true;
      }

      /* 
       * Check if tx.origin has the UID, and has delegated that to `account`
       * tx.origin should only ever be used for access control - it should never be used to determine
       * the target address for any economic actions
       * e.g. tx.origin should never be used as the source of truth for the target address to
       * credit/debit/mint/burn any tokens to/from
       * WARNING: If tx.origin is 0x0 (e.g. in blockchain explorers such as Etherscan) this function will
       * throw an error if the account is not go listed.
      /* solhint-disable avoid-tx-origin */
      uint256 txOriginIdBalance = uniqueIdentity.balanceOf(tx.origin, idType);
      if (txOriginIdBalance > 0) {
        return uniqueIdentity.isApprovedForAll(tx.origin, account);
      }
      /* solhint-enable avoid-tx-origin */
    }

    return false;
  }

  /**
   * @notice Returns a dynamic array of all UID types
   */
  function getAllIdTypes() public view returns (uint256[] memory) {
    // create a dynamic array and copy the fixed array over so we return a dynamic array
    uint256[] memory _allIdTypes = new uint256[](allIdTypes.length);
    for (uint256 i = 0; i < allIdTypes.length; i++) {
      _allIdTypes[i] = allIdTypes[i];
    }

    return _allIdTypes;
  }

  /**
   * @notice Returns whether the provided account is go-listed for any UID type
   * @param account The account whose go status to obtain
   * @return The account's go status
   */
  function go(address account) public view override returns (bool) {
    return goOnlyIdTypes(account, getAllIdTypes());
  }
}
