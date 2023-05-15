// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract TestERC20 is ERC20("USD Coin", "USDC"), ERC20Permit("USD Coin") {
  uint8 internal _decimals;

  constructor(uint256 initialSupply, uint8 __decimals) {
    _decimals = __decimals;
    _mint(msg.sender, initialSupply);
  }

  function decimals() public view virtual override returns (uint8) {
    return _decimals;
  }
}
