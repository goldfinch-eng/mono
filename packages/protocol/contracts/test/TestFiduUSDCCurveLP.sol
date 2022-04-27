// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/ERC20Permit.sol";

import "../interfaces/IGoldfinchConfig.sol";
import "../interfaces/ICurveLP.sol";
import "../protocol/core/ConfigOptions.sol";

contract TestFiduUSDCCurveLP is
  ERC20("LP FIDU-USDC Curve", "FIDUUSDCCURVE"),
  ERC20Permit("LP FIDU-USDC Curve"),
  ICurveLP
{
  uint256 private constant MULTIPLIER_DECIMALS = 1e18;

  IGoldfinchConfig public config;

  uint256 private virtual_price = MULTIPLIER_DECIMALS;
  uint256 private slippage = MULTIPLIER_DECIMALS;

  constructor(
    uint256 initialSupply,
    uint8 decimals,
    IGoldfinchConfig _config
  ) public {
    _setupDecimals(decimals);
    _mint(msg.sender, initialSupply);
    config = _config;
  }

  function token() public view override returns (address) {
    return address(this);
  }

  // Mock slippage when adding liquidity
  function _set_slippage(uint256 new_slippage) external {
    slippage = new_slippage;
  }

  function _set_virtual_price(uint256 new_virtual_price) external {
    virtual_price = new_virtual_price;
  }

  function get_virtual_price() public view override returns (uint256) {
    return virtual_price;
  }

  /// @notice Mock calc_token_amount function that returns the sum of both token amounts
  function calc_token_amount(uint256[2] memory amounts) public view override returns (uint256) {
    return amounts[0].add(amounts[1]);
  }

  /// @notice Mock add_liquidity function that mints Curve LP tokens
  function add_liquidity(
    uint256[2] memory amounts,
    uint256 min_mint_amount,
    bool use_eth,
    address receiver
  ) public override returns (uint256) {
    // Transfer FIDU and USDC from caller to this contract
    getFidu().transferFrom(msg.sender, address(this), amounts[0]);
    getUSDC().transferFrom(msg.sender, address(this), amounts[1]);

    uint256 amount = calc_token_amount(amounts).mul(slippage).div(MULTIPLIER_DECIMALS);

    require(amount >= min_mint_amount, "Slippage too high");

    _mint(receiver, amount);
    return amount;
  }

  function balances(uint256 arg0) public view override returns (uint256) {
    return 0;
  }

  function getUSDC() internal returns (ERC20) {
    return ERC20(config.getAddress(uint256(ConfigOptions.Addresses.USDC)));
  }

  function getFidu() internal returns (ERC20) {
    return ERC20(config.getAddress(uint256(ConfigOptions.Addresses.Fidu)));
  }
}
