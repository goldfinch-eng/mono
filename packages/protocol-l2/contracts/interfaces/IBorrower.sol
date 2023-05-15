// SPDX-Licence-Identifier: MIT

pragma solidity ^0.8.19;

interface IBorrower {
  function initialize(address owner, address _config) external;

  function drawdown(address poolAddress, uint256 amount, address addressToSendTo) external;
}
