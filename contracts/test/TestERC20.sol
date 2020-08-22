// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FIDU is ERC20 {
    constructor(uint256 initialSupply) public ERC20("FIDU", "FIDU") {
        _mint(msg.sender, initialSupply);
    }
}