// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

/// @dev This interface provides a subset of the functionality of the IGoldfinchIdentity
/// interface -- namely, the subset of functionality needed by Goldfinch protocol contracts
/// compiled with Solidity version 0.6.12.
interface IGoldfinchIdentity0612 {
  function balanceOf(address account, uint256 id) external view returns (uint256);
}
