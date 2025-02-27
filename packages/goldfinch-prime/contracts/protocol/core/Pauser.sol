// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AccessControlUpgradeable} from "./access/AccessControlUpgradeable.sol";
import {IPauser} from "../../interfaces/IPauser.sol";

/**
 * @title Pauser
 * @notice This contract is used to pause/unpause other contracts in the protocol, in conjunction with
 *  Pausable. It also provides a single global pause/unpause switch that pauses all contracts at once.
 * @author Goldfinch
 */

abstract contract Pauser is AccessControlUpgradeable, IPauser {
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  bool internal globalPaused;
  mapping(address => bool) internal pausedContracts;

  // solhint-disable-next-line func-name-mixedcase
  function __Pauser_init() public onlyInitializing {}

  function isPaused(address addr) external view returns (bool) {
    return globalPaused || pausedContracts[addr];
  }

  function pause(address addr) external onlyPauserRole {
    pausedContracts[addr] = true;
    emit Paused(addr);
  }

  function unpause(address addr) external onlyPauserRole {
    pausedContracts[addr] = false;
    emit Unpaused(addr);
  }

  function globalPause() external onlyPauserRole {
    globalPaused = true;
    emit GlobalPaused();
  }

  function globalUnpause() external onlyPauserRole {
    globalPaused = false;
    emit GlobalUnpaused();
  }

  modifier onlyPauserRole() {
    /// @dev NA: not authorized
    require(hasRole(PAUSER_ROLE, _msgSender()), "NA");
    _;
  }

  uint256[50] private __gap1;
  uint256[50] private __gap2;
}