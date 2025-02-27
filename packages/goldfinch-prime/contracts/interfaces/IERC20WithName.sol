// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./IERC20.sol";

/**
 * @dev Interface of the ERC20 standard along with the "name()" function.
 */
interface IERC20WithName is IERC20 {
  function name() external view returns (string memory);
}
