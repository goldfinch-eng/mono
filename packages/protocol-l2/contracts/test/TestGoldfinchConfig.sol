// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "../protocol/core/GoldfinchConfig.sol";

contract TestGoldfinchConfig is GoldfinchConfig {
  function setAddressForTest(uint256 addressKey, address newAddress) public {
    addresses[addressKey] = newAddress;
  }
}
