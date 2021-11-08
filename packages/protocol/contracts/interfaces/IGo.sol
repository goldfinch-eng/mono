// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

abstract contract IGo {
  uint256 public constant ID_TYPE_0 = 0;
  uint256 public constant ID_TYPE_1 = 1;
  uint256 public constant ID_TYPE_2 = 2;
  uint256 public constant ID_TYPE_3 = 3;
  uint256 public constant ID_TYPE_4 = 4;
  uint256 public constant ID_TYPE_5 = 5;
  uint256 public constant ID_TYPE_6 = 6;
  uint256 public constant ID_TYPE_7 = 7;
  uint256 public constant ID_TYPE_8 = 8;
  uint256 public constant ID_TYPE_9 = 9;
  uint256 public constant ID_TYPE_10 = 10;
  uint256[] public allIdTypes = [
    ID_TYPE_0,
    ID_TYPE_1,
    ID_TYPE_2,
    ID_TYPE_3,
    ID_TYPE_4,
    ID_TYPE_5,
    ID_TYPE_6,
    ID_TYPE_7,
    ID_TYPE_8,
    ID_TYPE_9,
    ID_TYPE_10
  ];

  /// @notice Returns the address of the UniqueIdentity contract.
  function uniqueIdentity() external virtual returns (address);

  function go(address account) external virtual returns (bool);

  function goOnlyIdTypes(address account, uint256[] calldata onlyIdTypes) external virtual returns (bool);

  function goSeniorPool(address account) external virtual returns (bool);

  function updateGoldfinchConfig() external virtual;
}
