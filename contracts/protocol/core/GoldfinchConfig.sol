// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

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

    emit AddressUpdated(msg.sender, ConfigOptions.getAddressName(addressKey), addresses[addressKey], newAddress);
    addresses[addressKey] = newAddress;
  }

  function setNumber(uint256 number, uint256 newNumber) public onlyAdmin {
    emit NumberUpdated(msg.sender, ConfigOptions.getNumberName(number), numbers[number], newNumber);
    numbers[number] = newNumber;
  }

  function setCreditLineImplementation(address newCreditLine) public onlyAdmin {
    uint256 addressKey = uint256(ConfigOptions.Addresses.CreditLineImplementation);
    emit AddressUpdated(msg.sender, ConfigOptions.getAddressName(addressKey), addresses[addressKey], newCreditLine);
    addresses[addressKey] = newCreditLine;
  }

  function setTreasuryReserve(address newTreasuryReserve) public onlyAdmin {
    uint256 key = uint256(ConfigOptions.Addresses.TreasuryReserve);
    emit AddressUpdated(msg.sender, ConfigOptions.getAddressName(key), addresses[key], newTreasuryReserve);
    addresses[key] = newTreasuryReserve;
  }

  /*
    Using custom getters incase we want to change underlying implementation later,
    or add checks or validations later on.
  */
  function getAddress(uint256 addressKey) public view returns (address) {
    return addresses[addressKey];
  }

  function getNumber(uint256 number) public view returns (uint256) {
    return numbers[number];
  }
}
