// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../interfaces/ISeniorPoolStrategy.sol";
import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/ITranchedPool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract LeverageRatioStrategy is BaseUpgradeablePausable, ISeniorPoolStrategy {
  using SafeMath for uint256;

  uint256 private constant LEVERAGE_RATIO_DECIMALS = 1e18;

  function getLeverageRatio(ITranchedPool pool) public view virtual override returns (uint256) {
    // We expect this method to have been overridden by the contract inheriting from this contract.
    assert(false);
  }

  /**
   * @notice Determines how much money to invest in the senior tranche based on what is committed to the junior
   * tranche and a fixed leverage ratio to the junior.
   * TODO[PR] I've removed the comment that this function is idempotent. It's a view function so
   * it's not state-changing, and it's not a pure function because it depends on the leverage ratio
   * which is not an argument to the function.
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

    return _invest(pool, juniorTranche, seniorTranche);
  }

  /**
   * @notice Determines how much money to invest in the senior tranche based on what is committed to the junior
   * tranche and a leverage ratio to the junior tranche, as if all conditions for investment were met.
   * TODO[PR] Likewise here I removed the comment that the function is idempotent.
   * @param seniorPool The fund to invest from
   * @param pool The pool to invest into (as the senior)
   * @return The amount of money to invest into the pool from the fund
   */
  function estimateInvestment(ISeniorPool seniorPool, ITranchedPool pool) public view override returns (uint256) {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));
    ITranchedPool.TrancheInfo memory seniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Senior));

    return _invest(pool, juniorTranche, seniorTranche);
  }

  function _invest(
    ITranchedPool pool,
    ITranchedPool.TrancheInfo memory juniorTranche,
    ITranchedPool.TrancheInfo memory seniorTranche
  ) internal view returns (uint256) {
    uint256 juniorCapital = juniorTranche.principalDeposited;
    uint256 existingSeniorCapital = seniorTranche.principalDeposited;
    uint256 seniorTarget = juniorCapital.mul(getLeverageRatio(pool)).div(LEVERAGE_RATIO_DECIMALS);

    if (existingSeniorCapital >= seniorTarget) {
      return 0;
    }

    return seniorTarget.sub(existingSeniorCapital);
  }
}
