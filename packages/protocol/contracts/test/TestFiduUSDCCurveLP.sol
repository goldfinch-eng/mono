// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/ERC20Permit.sol";

import "../interfaces/IGoldfinchConfig.sol";
import "../protocol/core/ConfigOptions.sol";

import "hardhat/console.sol";

contract TestFiduUSDCCurveLP is ERC20("LP FIDU-USDC Curve", "FIDUUSDCCURVE"), ERC20Permit("LP FIDU-USDC Curve") {
  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  IGoldfinchConfig public config;

  constructor(
    uint256 initialSupply,
    uint8 decimals,
    IGoldfinchConfig _config
  ) public {
    _setupDecimals(decimals);
    _mint(msg.sender, initialSupply);
    config = _config;
  }

  function getVirtualPrice() external view returns (uint256) {
    return MULTIPLIER_DECIMALS;
  }

  /// @notice Mock calcTokenAmount function that returns the sum of both token amounts
  function calcTokenAmount(uint256[2] calldata amounts, bool isDeposit) external view returns (uint256) {
    return amounts[0].add(amounts[1]);
  }

  /// @notice Mock addLiquidity function that mints Curve LP tokens
  function addLiquidity(
    uint256[2] calldata amounts,
    uint256 minMintAmount,
    address receiver
  ) external returns (uint256) {
    // Transfer FIDU and USDC from caller to this contract
    getFidu().transferFrom(msg.sender, address(this), amounts[1]);
    getUSDC().transferFrom(msg.sender, address(this), amounts[1]);

    uint256 amount = this.calcTokenAmount(amounts, true);

    _mint(receiver, amount);
    return amount;
  }

  function getUSDC() internal returns (ERC20) {
    return ERC20(config.getAddress(uint256(ConfigOptions.Addresses.USDC)));
  }

  function getFidu() internal returns (ERC20) {
    return ERC20(config.getAddress(uint256(ConfigOptions.Addresses.Fidu)));
  }
}
