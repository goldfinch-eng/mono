// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract TestERC20 is ERC20Upgradeable {
  constructor(uint256 initialSupply, uint8 decimals) public {
    __ERC20_init("USDC", "USDC");
    _setupDecimals(decimals);
    _mint(msg.sender, initialSupply);
  }
}
