// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

interface ITestUniqueIdentity0612 {
  function _mintForTest(address to, uint256 id, uint256 amount, bytes memory data) external;

  function _burnForTest(address account, uint256 id) external;

  function initialize(address owner, string memory uri) external;

  function setSupportedUIDTypes(uint256[] calldata ids, bool[] calldata values) external;

  function setApprovalForAll(address _operator, bool _approved) external;

  function isApprovedForAll(address account, address operator) external view returns (bool);

  function balanceOf(address account, uint256 id) external view returns (uint256);
}
