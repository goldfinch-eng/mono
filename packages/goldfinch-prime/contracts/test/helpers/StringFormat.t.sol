// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library StringFormat {
  function formatAddress(address addr) public returns (string memory) {
    return Strings.toHexString(uint160(addr), 20);
  }

  function formatRole(bytes32 role) public returns (string memory) {
    return Strings.toHexString(uint256(role), 32);
  }
}
