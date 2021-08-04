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

  event LeverageRatioUpdated(
    address indexed pool,
    uint256 leverageRatio,
    uint256 juniorTrancheLockedUntil,
    bytes32 version
  );

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

  /**
   * @notice Updates the leverage ratio for the specified tranched pool.
   * @param pool The tranched pool whose leverage ratio to update.
   * @param leverageRatio The leverage ratio value to set for the tranched pool.
   * @param juniorTrancheLockedUntil The `lockedUntil` timestamp, of the tranched pool's
   * junior tranche, to which this calculation of `leverageRatio` corresponds, i.e. the
   * value of the `lockedUntil` timestamp of the JuniorCapitalLocked event which the caller
   * is calling this function in response to having observed. By providing this timestamp
   * (plus an assumption that we can trust the caller to report this value accurately),
   * the caller enables this function to enforce that a leverage ratio that is obsolete in
   * the sense of having been calculated for an obsolete `lockedUntil` timestamp cannot be set.
   * @param version An arbitrary identifier included in the LeverageRatioUpdated event emitted
   * by this function, enabling the caller to describe how it calculated `leverageRatio`. Using
   * the bytes32 type accommodates using git commit hashes (both the current SHA1 hashes, which
   * require 20 bytes; and the future SHA256 hashes, which require 32 bytes) for this value.
   */
  function setLeverageRatio(
    ITranchedPool pool,
    uint256 leverageRatio,
    uint256 juniorTrancheLockedUntil,
    bytes32 version
  ) public onlySetterRole {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));

    // TODO[PR] Anything stronger we can require about the `leverageRatio` value? Or should we allow 0?
    require(leverageRatio > 0, "Leverage ratio must be greater than 0.");

    require(juniorTrancheLockedUntil > 0, "Cannot set leverage ratio for unlocked junior tranche.");
    require(juniorTrancheLockedUntil == juniorTranche.lockedUntil, "`juniorTrancheLockedUntil` timestamp is obsolete.");

    ratios[address(pool)] = LeverageRatioInfo({
      leverageRatio: leverageRatio,
      juniorTrancheLockedUntil: juniorTrancheLockedUntil
    });

    emit LeverageRatioUpdated(address(pool), leverageRatio, juniorTrancheLockedUntil, version);
  }

  modifier onlySetterRole() {
    require(hasRole(SETTER_ROLE, _msgSender()), "Must have leverage-ratio setter role to perform this action");
    _;
  }
}
