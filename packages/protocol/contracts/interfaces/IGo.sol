// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

abstract contract IGo {
  uint256 ID_VERSION_0;
  uint256 ID_VERSION_1;
  uint256 ID_VERSION_2;
  uint256 ID_VERSION_3;
  uint256 ID_VERSION_4;
  uint256 ID_VERSION_5;
  uint256 ID_VERSION_6;
  uint256 ID_VERSION_7;
  uint256 ID_VERSION_8;
  uint256 ID_VERSION_9;
  uint256 ID_VERSION_10;

  /// @notice Returns the address of the UniqueIdentity contract.
  function uniqueIdentity() external virtual returns (address);

  function go(address account) external virtual returns (bool);

  function go(address account, uint256[] calldata onlyVersions) external virtual returns (bool);

  function updateGoldfinchConfig() external virtual;
}
