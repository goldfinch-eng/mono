// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor(uint256 initialSupply, uint8 decimals) public ERC20("USDC", "USDC") {
        _setupDecimals(decimals);
        _mint(msg.sender, initialSupply);
    }
}