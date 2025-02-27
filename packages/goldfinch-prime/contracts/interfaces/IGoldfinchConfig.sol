// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;
import {IPauser} from "../protocol/core/Pauser.sol";

interface IGoldfinchConfig is IPauser {
  function getNumber(uint256 index) external view returns (uint256);

  /*
    Using custom getters in case we want to change underlying implementation later,
    or add checks or validations later on.
  */
  function getAddress(uint256 index) external view returns (address);

  function setAddress(uint256 index, address newAddress) external;

  function setNumber(uint256 index, uint256 newNumber) external;
}
