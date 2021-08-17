// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../interfaces/ISeniorPoolStrategy.sol";
import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/ITranchedPool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract FixedLeverageRatioStrategy is BaseUpgradeablePausable, ISeniorPoolStrategy {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  uint256 private constant LEVERAGE_RATIO_DECIMALS = 1e18;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  function getLeverageRatio() public view returns (uint256) {
    return config.getLeverageRatio();
  }

  /**
   * @notice Determines how much money to invest in the senior tranche based on what is committed to the junior
   * tranche and a fixed leverage ratio to the junior. Idempotent.
   * @param seniorPool The fund to invest from
   * @param pool The pool to invest into (as the senior)
   * @return The amount of money to invest into the pool from the fund
   */
  function invest(ISeniorPool seniorPool, ITranchedPool pool) public view override returns (uint256) {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));
    ITranchedPool.TrancheInfo memory seniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Senior));

    // If junior capital is not yet invested, or pool already locked then don't invest anything
    if (juniorTranche.lockedUntil == 0 || seniorTranche.lockedUntil > 0) {
      return 0;
    }

    return _invest(juniorTranche, seniorTranche);
  }

  /**
   * @notice Determines how much money to invest in the senior tranche based on what is committed to the junior,
   * tranche and a fixed leverage ratio to the junior, as if all conditions for investment were
   * met. Idempotent.
   * @param seniorPool The fund to invest from
   * @param pool The pool to invest into (as the senior)
   * @return The amount of money to invest into the pool from the fund
   */
  function estimateInvestment(ISeniorPool seniorPool, ITranchedPool pool) public view override returns (uint256) {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));
    ITranchedPool.TrancheInfo memory seniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Senior));

    return _invest(juniorTranche, seniorTranche);
  }

  function _invest(ITranchedPool.TrancheInfo memory juniorTranche, ITranchedPool.TrancheInfo memory seniorTranche)
    internal
    view
    returns (uint256)
  {
    uint256 juniorCapital = juniorTranche.principalDeposited;
    uint256 existingSeniorCapital = seniorTranche.principalDeposited;
    uint256 seniorTarget = juniorCapital.mul(getLeverageRatio()).div(LEVERAGE_RATIO_DECIMALS);

    if (existingSeniorCapital >= seniorTarget) {
      return 0;
    }

    return seniorTarget.sub(existingSeniorCapital);
  }
}
