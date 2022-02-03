// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/ERC20Permit.sol";

contract TestFiduUSDCCurveLP is ERC20("LP FIDU-USDC Curve", "FIDUUSDCCURVE"), ERC20Permit("LP FIDU-USDC Curve") {
  constructor(uint256 initialSupply, uint8 decimals) public {
    _setupDecimals(decimals);
    _mint(msg.sender, initialSupply);
  }
}
