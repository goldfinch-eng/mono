// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";
import "../protocol/core/ConfigHelper.sol";

/**
 * @title GFI
 * @notice GFI is Goldfinch's governance token.
 * @author Goldfinch
 */
contract GFI is ERC20PresetMinterPauserUpgradeSafe {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  event GoldfinchConfigUpdated(address indexed who, address configAddress);

  /*
    We are using our own initializer function so we can set the owner by passing it in.
    I would override the regular "initializer" function, but I can't because it's not marked
    as "virtual" in the parent contract
  */
  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(
    address owner,
    string calldata name,
    string calldata symbol,
    GoldfinchConfig _config
  ) external initializer {
    __Context_init_unchained();
    __AccessControl_init_unchained();
    __ERC20_init_unchained(name, symbol);

    __ERC20Burnable_init_unchained();
    __Pausable_init_unchained();
    __ERC20Pausable_init_unchained();

    config = _config;

    _setupRole(MINTER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);
    _setupRole(OWNER_ROLE, owner);

    _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  function updateGoldfinchConfig() external {
    require(hasRole(OWNER_ROLE, _msgSender()), "ERC20PresetMinterPauser: Must have owner role to change config");
    config = GoldfinchConfig(config.configAddress());
    emit GoldfinchConfigUpdated(msg.sender, address(config));
  }
}
