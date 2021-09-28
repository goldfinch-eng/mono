// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../interfaces/IGo.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract Go is IGo, BaseUpgradeablePausable {
  // TODO[PR] Alternative approach would be to get address of the GoldfinchIdentity contract from config.
  address public immutable override goldfinchIdentity;

  using SafeMath for uint256;

  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  event GoldfinchConfigUpdated(address indexed who, address configAddress);

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
    emit GoldfinchConfigUpdated(msg.sender, address(config));
  }

  /**
   * @notice Returns whether the provided account is go-listed for use of the Goldfinch protocol.
   * This status is defined as: whether `balanceOf(account, id)` on the GoldfinchIdentity
   * contract is non-zero (where `id` is a supported token id on GoldfinchIdentity), falling back to the
   * account's status on the legacy go-list maintained on GoldfinchConfig.
   * @param account The account whose go status to obtain
   * @return The account's go status
   */
  function go(address account) public view override returns (bool) {
    require(account != address(0), "Zero address is not go-listed.");
    uint256 balance = IGoldfinchIdentity(
      goldfinchIdentity,
      /// @dev If GoldfinchIdentity is upgraded to support token ids besides 0, this contract must
      /// be upgraded to handle the set of possible ids.
      0
    ).balanceOf(account);
    return balance > 0 || config.goList(account);
  }
}
