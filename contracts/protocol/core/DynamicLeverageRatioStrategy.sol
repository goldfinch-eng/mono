// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "./LeverageRatioStrategy.sol";
import "../../interfaces/ISeniorPoolStrategy.sol";
import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/ITranchedPool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract DynamicLeverageRatioStrategy is LeverageRatioStrategy {
  // TODO[PR] Should we give our future selves access to the config? We don't need it for now.

  bytes32 public constant SETTER_ROLE = keccak256("SETTER_ROLE");

  struct LeverageRatioInfo {
    uint256 leverageRatio;
    uint256 juniorTrancheLockedUntil;
  }

  // tranchedPoolAddress => leverageRatioInfo
  mapping(address => LeverageRatioInfo) public ratios;

  function initialize(address owner) public initializer {
    require(owner != address(0), "Owner address cannot be empty");

    __BaseUpgradeablePausable__init(owner);

    _setupRole(SETTER_ROLE, owner);

    _setRoleAdmin(SETTER_ROLE, OWNER_ROLE);
  }

  function getLeverageRatio(ITranchedPool pool) public view override returns (uint256) {
    LeverageRatioInfo memory ratioInfo = ratios[address(pool)];
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    assert(ratioInfo.juniorTrancheLockedUntil > 0);
    require(
      ratioInfo.juniorTrancheLockedUntil == juniorTranche.lockedUntil,
      "Leverage ratio is obsolete. Wait for its recalculation."
    );

    return ratioInfo.leverageRatio;
  }

  function setLeverageRatio(
    ITranchedPool pool,
    uint256 leverageRatio,
    uint256 juniorTrancheLockedUntil
  ) public onlySetterRole {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    // TODO[PR] Anything stronger we can require about the `leverageRatio` value?
    require(leverageRatio > 0, "Leverage ratio must be greater than 0.");

    require(juniorTrancheLockedUntil > 0, "Cannot set leverage ratio for unlocked junior tranche.");
    require(juniorTrancheLockedUntil == juniorTranche.lockedUntil, "`juniorTrancheLockedUntil` timestamp is obsolete.");

    ratios[address(pool)] = LeverageRatioInfo({
      leverageRatio: leverageRatio,
      juniorTrancheLockedUntil: juniorTrancheLockedUntil
    });
  }

  modifier onlySetterRole() {
    require(hasRole(SETTER_ROLE, _msgSender()), "Must have leverage-ratio setter role to perform this action");
    _;
  }
}
