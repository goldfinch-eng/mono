// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {ConfigOptions} from "./ConfigOptions.sol";
import {Pauser} from "./Pauser.sol";

/**
 * @title GoldfinchConfig
 * @notice This contract stores mappings of useful "protocol config state", giving a central place
 *  for all other contracts to access it. For example, the PoolTokens address. These config vars
 *  are enumerated in the `ConfigOptions` library, and can only be changed by admins of the protocol.
 * @author Goldfinch
 */

contract GoldfinchConfig is BaseUpgradeablePausable, Pauser, IGoldfinchConfig {
  mapping(uint256 => address) public addresses;
  mapping(uint256 => uint256) public numbers;

  event AddressUpdated(address owner, uint256 index, address oldValue, address newValue);
  event NumberUpdated(address owner, uint256 index, uint256 oldValue, uint256 newValue);

  bool public valuesInitialized;

  function initialize(address owner) public initializer {
    require(owner != address(0), "Owner address cannot be empty");

    __BaseUpgradeablePausable__init(owner, this);
    _setupRole(PAUSER_ROLE, owner);
    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
  }

  /// @inheritdoc IGoldfinchConfig
  function setAddress(uint256 addressIndex, address newAddress) public override onlyAdmin {
    require(addresses[addressIndex] == address(0), "Address has already been initialized");

    emit AddressUpdated(msg.sender, addressIndex, addresses[addressIndex], newAddress);
    addresses[addressIndex] = newAddress;
  }

  /// @inheritdoc IGoldfinchConfig
  function setNumber(uint256 index, uint256 newNumber) public override onlyAdmin {
    emit NumberUpdated(msg.sender, index, numbers[index], newNumber);
    numbers[index] = newNumber;
  }

  function setTreasuryReserve(address newTreasuryReserve) public onlyAdmin {
    uint256 key = uint256(ConfigOptions.Addresses.TreasuryReserve);
    emit AddressUpdated(msg.sender, key, addresses[key], newTreasuryReserve);
    addresses[key] = newTreasuryReserve;
  }

  function setGoldfinchConfig(address newAddress) public onlyAdmin {
    uint256 key = uint256(ConfigOptions.Addresses.GoldfinchConfig);
    emit AddressUpdated(msg.sender, key, addresses[key], newAddress);
    addresses[key] = newAddress;
  }

  function setMonthlyScheduleRepo(address newAddress) public onlyAdmin {
    uint256 key = uint256(ConfigOptions.Addresses.MonthlyScheduleRepo);
    emit AddressUpdated(msg.sender, key, addresses[key], newAddress);
    addresses[key] = newAddress;
  }

  function initializeFromOtherConfig(
    address _initialConfig,
    uint256 numbersLength,
    uint256 addressesLength
  ) public onlyAdmin {
    require(!valuesInitialized, "Already initialized values");
    IGoldfinchConfig initialConfig = IGoldfinchConfig(_initialConfig);
    for (uint256 i = 0; i < numbersLength; i++) {
      setNumber(i, initialConfig.getNumber(i));
    }

    for (uint256 i = 0; i < addressesLength; i++) {
      if (getAddress(i) == address(0)) {
        setAddress(i, initialConfig.getAddress(i));
      }
    }
    valuesInitialized = true;
  }

  /// @inheritdoc IGoldfinchConfig
  function getAddress(uint256 index) public view override returns (address) {
    return addresses[index];
  }

  function getNumber(uint256 index) public view override returns (uint256) {
    return numbers[index];
  }
}
