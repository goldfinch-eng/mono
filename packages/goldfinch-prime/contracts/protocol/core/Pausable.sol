// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IPauser} from "./Pauser.sol";

/**
 * @title Pausable
 * @notice This contract, in conjunction with Pauser, allows an inheriting contract to be paused and
 *  unpaused.
 * @author Goldfinch
 */

abstract contract Pausable is Initializable {
  IPauser pauser;

  function __Pausable_init(IPauser _pauser) internal onlyInitializing {
    require(address(_pauser) != address(0), "ZA");
    pauser = _pauser;
  }

  modifier whenNotPaused() {
    _requireNotPaused();
    _;
  }

  function _requireNotPaused() internal view virtual {
    require(!paused(), "Pausable: paused");
  }

  function paused() public view virtual returns (bool) {
    return pauser.isPaused(address(this));
  }

  uint256[100] private __gap;
}
