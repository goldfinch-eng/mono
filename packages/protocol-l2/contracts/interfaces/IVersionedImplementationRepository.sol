// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./IImplementationRepository.sol";

interface IVersionedImplementationRepository is IImplementationRepository {
  function getByVersion(uint8[3] calldata version) external view returns (address);

  function hasVersion(uint8[3] calldata version) external view returns (bool);
}
