// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract FuzzingHelper {
  mapping(address => bool) private addressDenyList;

  function exclude(address _address) public {
    addressDenyList[_address] = true;
  }

  /// @notice Addresses are allowed by default. You only need to call this
  /// if you previously called excludeAddress for the same address
  function allow(address _address) public {
    addressDenyList[_address] = false;
  }

  function isAllowed(address _address) public view returns (bool) {
    return !addressDenyList[_address];
  }
}
