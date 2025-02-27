// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {AccessControlUpgradeable} from "./access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Pausable} from "./Pausable.sol";
import {IPauser} from "./Pauser.sol";

/**
 * @title BaseUpgradeablePausable contract
 * @notice This is our Base contract that most other contracts inherit from. It includes many standard
 *  useful abilities like upgradeability, pausability, access control, and re-entrancy guards.
 * @author Goldfinch
 */

contract BaseUpgradeablePausable is
  Initializable,
  AccessControlUpgradeable,
  Pausable,
  ReentrancyGuardUpgradeable
{
  bytes32 internal constant OWNER_ROLE = keccak256("OWNER_ROLE");
  // Pre-reserving a few slots in the base contract in case we need to add things in the future.
  // This does not actually take up gas cost or storage cost, but it does reserve the storage slots.
  // See OpenZeppelin's use of this pattern here:
  // https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/GSN/Context.sol#L37
  uint256[50] private __gap1;
  uint256[50] private __gap2;
  uint256[50] private __gap3;
  uint256[50] private __gap4;

  /// @dev ZA: Zero Address
  // solhint-disable-next-line func-name-mixedcase
  function __BaseUpgradeablePausable__init(address owner, IPauser pauser) public onlyInitializing {
    require(owner != address(0), "ZA");
    __AccessControl_init_unchained();
    __Pausable_init(pauser);
    __ReentrancyGuard_init_unchained();

    _setupRole(OWNER_ROLE, owner);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  function isAdmin() public view returns (bool) {
    return hasRole(OWNER_ROLE, _msgSender());
  }

  /// @dev NA: Not Admin
  modifier onlyAdmin() {
    require(isAdmin(), "NA");
    _;
  }
}
