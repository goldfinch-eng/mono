// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

interface IERC20Splitter {
  function lastDistributionAt() external view returns (uint256);

  function distribute() external;

  function replacePayees(address[] calldata _payees, uint256[] calldata _shares) external;

  function pendingDistributionFor(address payee) external view returns (uint256);
}
