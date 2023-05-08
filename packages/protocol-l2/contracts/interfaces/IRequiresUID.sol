// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

interface IRequiresUID {
  function hasAllowedUID(address sender) external view returns (bool);
}
