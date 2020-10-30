// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IFidu.sol";
import "./interfaces/ICreditDesk.sol";
import "./interfaces/IERC20withDec.sol";

library ConfigHelper {
  function getPool(GoldfinchConfig config) internal view returns (IPool) {
    return IPool(poolAddress(config));
  }

  function getUSDC(GoldfinchConfig config) internal view returns (IERC20withDec) {
    return IERC20withDec(config.getAddress(uint256(ConfigOptions.Addresses.USDC)));
  }

  function getCreditDesk(GoldfinchConfig config) internal view returns (ICreditDesk) {
    return ICreditDesk(creditDeskAddress(config));
  }

  function getFidu(GoldfinchConfig config) internal view returns (IFidu) {
    return IFidu(fiduAddress(config));
  }

  function poolAddress(GoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.Pool));
  }

  function creditDeskAddress(GoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.CreditDesk));
  }

  function fiduAddress(GoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.Fidu));
  }

  function reserveAddress(GoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve));
  }

  function getReserveDenominator(GoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.ReserveDenominator));
  }

  function getWithdrawFeeDenominator(GoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.WithdrawFeeDenominator));
  }
}