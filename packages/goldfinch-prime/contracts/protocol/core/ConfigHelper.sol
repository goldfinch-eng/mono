// SPDX-License-Identifier: MIT

pragma solidity >=0.8.19;

import {ConfigOptions} from "./ConfigOptions.sol";
import {IERC20withDec} from "../../interfaces/IERC20withDec.sol";
import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IGo} from "../../interfaces/IGo.sol";

/**
 * @title ConfigHelper
 * @notice A convenience library for getting easy access to other contracts and constants within the
 *  protocol, through the use of the GoldfinchConfig contract
 * @author Goldfinch
 */

library ConfigHelper {
  function getUSDC(IGoldfinchConfig config) internal view returns (IERC20withDec) {
    return IERC20withDec(usdcAddress(config));
  }

  function getGo(IGoldfinchConfig config) internal view returns (IGo) {
    return IGo(goAddress(config));
  }

  function configAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.GoldfinchConfig));
  }

  function usdcAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.USDC));
  }

  function reserveAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve));
  }

  function protocolAdminAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.ProtocolAdmin));
  }

  function goAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.Go));
  }

  function getReserveDenominator(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.ReserveDenominator));
  }

  function getLatenessGracePeriodInDays(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays));
  }
}
