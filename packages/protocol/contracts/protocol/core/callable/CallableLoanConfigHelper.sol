// SPDX-License-Identifier: MIT

pragma solidity >=0.8.17;
pragma experimental ABIEncoderV2;

import {ConfigOptions} from "../ConfigOptions.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {IERC20UpgradeableWithDec} from "../../../interfaces/IERC20UpgradeableWithDec.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IGoldfinchFactory} from "../../../interfaces/IGoldfinchFactory.sol";
import {IGo} from "../../../interfaces/IGo.sol";
import {ICurveLP} from "../../../interfaces/ICurveLP.sol";

/**
 * @title ConfigHelper
 * @notice A convenience library for getting easy access to other contracts and constants within the
 *  protocol, through the use of the IGoldfinchConfig contract
 * @author Goldfinch
 */

library CallableLoanConfigHelper {
  function getUSDC(IGoldfinchConfig config) internal view returns (IERC20UpgradeableWithDec) {
    return IERC20UpgradeableWithDec(usdcAddress(config));
  }

  function getPoolTokens(IGoldfinchConfig config) internal view returns (IPoolTokens) {
    return IPoolTokens(poolTokensAddress(config));
  }

  function getGoldfinchFactory(IGoldfinchConfig config) internal view returns (IGoldfinchFactory) {
    return IGoldfinchFactory(goldfinchFactoryAddress(config));
  }

  function getGo(IGoldfinchConfig config) internal view returns (IGo) {
    return IGo(goAddress(config));
  }

  function creditLineImplementationAddress(
    IGoldfinchConfig config
  ) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation));
  }

  /// @dev deprecated because we no longer use GSN
  function trustedForwarderAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.TrustedForwarder));
  }

  function configAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.GoldfinchConfig));
  }

  function poolTokensAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.PoolTokens));
  }

  function backerRewardsAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.BackerRewards));
  }

  function goldfinchFactoryAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.GoldfinchFactory));
  }

  function gfiAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.GFI));
  }

  function cusdcContractAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.CUSDCContract));
  }

  function usdcAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.USDC));
  }

  function tranchedPoolAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.TranchedPoolImplementation));
  }

  function reserveAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve));
  }

  function protocolAdminAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.ProtocolAdmin));
  }

  function borrowerImplementationAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.BorrowerImplementation));
  }

  function goAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.Go));
  }

  function stakingRewardsAddress(IGoldfinchConfig config) internal view returns (address) {
    return config.getAddress(uint256(ConfigOptions.Addresses.StakingRewards));
  }

  function getReserveDenominator(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.ReserveDenominator));
  }

  function getWithdrawFeeDenominator(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.WithdrawFeeDenominator));
  }

  function getLatenessGracePeriodInDays(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays));
  }

  function getLatenessMaxDays(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.LatenessMaxDays));
  }

  function getDrawdownPeriodInSeconds(IGoldfinchConfig config) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds));
  }

  function getTransferRestrictionPeriodInDays(
    IGoldfinchConfig config
  ) internal view returns (uint256) {
    return config.getNumber(uint256(ConfigOptions.Numbers.TransferRestrictionPeriodInDays));
  }
}
