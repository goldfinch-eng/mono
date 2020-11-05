// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./BaseUpgradeablePausable.sol";
import "./ConfigOptions.sol";

/**
 * @title GoldfinchConfig
 * @notice This contract stores mappings of useful "protocol config state", giving a central place
 *  for all other contracts to access it. For example, the TransactionLimit, or the PoolAddress. These config vars
 *  are enumerated in the `ConfigOptions` library, and can only be changed by admins of the protocol.
 * @author Goldfinch
 */

contract GoldfinchConfig is BaseUpgradeablePausable {
  mapping(uint256 => address) public addresses;
  mapping(uint256 => uint256) public numbers;

  event AddressUpdated(address owner, string name, address oldValue, address newValue);
  event NumberUpdated(address owner, string name, uint256 oldValue, uint256 newValue);

  function initialize(address owner) public initializer {
    __BaseUpgradeablePausable__init(owner);
  }

  function setAddress(uint256 addressKey, address newAddress) public onlyAdmin {
    require(addresses[addressKey] == address(0), "Address has already been initialized");

    string memory name = ConfigOptions.getAddressName(addressKey);
    emit AddressUpdated(msg.sender, name, addresses[addressKey], newAddress);
    addresses[addressKey] = newAddress;
  }

  function setNumber(uint256 number, uint256 newNumber) public onlyAdmin {
    string memory name = ConfigOptions.getNumberName(number);
    emit NumberUpdated(msg.sender, name, numbers[number], newNumber);
    numbers[number] = newNumber;
  }

  function setCreditLineImplementation(address newCreditLine) public onlyAdmin {
    uint256 addressKey = uint256(ConfigOptions.Addresses.CreditLineImplementation);
    string memory name = ConfigOptions.getAddressName(addressKey);
    emit AddressUpdated(msg.sender, name, addresses[addressKey], newCreditLine);
    addresses[addressKey] = newCreditLine;
  }

  function setTreasuryReserve(address newTreasuryReserve) public onlyAdmin {
    uint256 addressKey = uint256(ConfigOptions.Addresses.TreasuryReserve);
    string memory name = ConfigOptions.getAddressName(addressKey);
    emit AddressUpdated(msg.sender, name, addresses[addressKey], newTreasuryReserve);
    addresses[addressKey] = newTreasuryReserve;
  }

  /*
    Using custom getters incase we want to change underlying implementation later,
    or add checks or validations later on.
  */
  function getAddress(uint256 addressKey) public view returns (address) {
    // Cheap way to see if it's an invalid number
    ConfigOptions.Addresses(addressKey);
    return addresses[addressKey];
  }

  function getNumber(uint256 number) public view returns (uint256) {
    // Cheap way to see if it's an invalid number
    ConfigOptions.Numbers(number);
    return numbers[uint256(number)];
  }
}
