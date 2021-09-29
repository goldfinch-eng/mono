// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev {ERC1155} token, including:
 *
 *  - ability to burn (destroy) tokens
 *  - a pauser role that allows to stop all token transfers (including minting and burning)
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * Adapted from OZ's ERC1155PresetMinterPauserUpgradeable.sol: removed MINTER_ROLE;
 * replaced DEFAULT_ADMIN_ROLE with OWNER_ROLE.
 */
contract ERC1155PresetPauserUpgradeable is
  Initializable,
  ContextUpgradeable,
  AccessControlEnumerableUpgradeable,
  ERC1155BurnableUpgradeable,
  ERC1155PausableUpgradeable
{
  function initialize(string memory uri) public virtual initializer {
    __ERC1155PresetPauser_init(uri);
  }

  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  /**
   * @dev Grants `OWNER_ROLE` and `PAUSER_ROLE` to the account that
   * deploys the contract.
   */
  function __ERC1155PresetPauser_init(string memory uri) internal initializer {
    __Context_init_unchained();
    __ERC165_init_unchained();
    __AccessControl_init_unchained();
    __AccessControlEnumerable_init_unchained();
    __ERC1155_init_unchained(uri);
    __ERC1155Burnable_init_unchained();
    __Pausable_init_unchained();
    __ERC1155Pausable_init_unchained();
    __ERC1155PresetPauser_init_unchained(uri);
  }

  function __ERC1155PresetPauser_init_unchained(string memory uri) internal initializer {
    _setupRole(OWNER_ROLE, _msgSender());
    _setupRole(PAUSER_ROLE, _msgSender());
  }

  /**
   * @dev Pauses all token transfers.
   *
   * See {ERC1155Pausable} and {Pausable-_pause}.
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function pause() public virtual {
    require(hasRole(PAUSER_ROLE, _msgSender()), "ERC1155PresetPauser: must have pauser role to pause");
    _pause();
  }

  /**
   * @dev Unpauses all token transfers.
   *
   * See {ERC1155Pausable} and {Pausable-_unpause}.
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function unpause() public virtual {
    require(hasRole(PAUSER_ROLE, _msgSender()), "ERC1155PresetPauser: must have pauser role to unpause");
    _unpause();
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override(ERC1155Upgradeable, ERC1155PausableUpgradeable) {
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  uint256[50] private __gap;
}
