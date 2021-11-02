// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IGo {
  /// @notice Returns the address of the UniqueIdentity contract.
  function uniqueIdentity() external view returns (address);

  function go(address account) external view returns (bool);

  function updateGoldfinchConfig() external;
}
