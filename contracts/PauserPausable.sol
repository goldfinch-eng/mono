// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/AccessControl.sol";

contract PauserPausable is AccessControlUpgradeSafe, PausableUpgradeSafe {
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  // solhint-disable-next-line func-name-mixedcase
  function __PauserPausable__init() public initializer {
    __Pausable_init_unchained();
  }

  /**
   * @dev Pauses all functions guarded by Pause
   *
   * See {Pausable-_pause}.
   *
   * Requirements:
   *
   * - the caller must have the PAUSER_ROLE.
   */

  function pause() public {
    require(hasRole(PAUSER_ROLE, _msgSender()), "Must have pauser role to pause");
    _pause();
  }

  /**
   * @dev Unpauses the contract
   *
   * See {Pausable-_unpause}.
   *
   * Requirements:
   *
   * - the caller must have the Pauser role
   */
  function unpause() public {
    require(hasRole(PAUSER_ROLE, _msgSender()), "Must have pauser role to unpause");
    _unpause();
  }
}
