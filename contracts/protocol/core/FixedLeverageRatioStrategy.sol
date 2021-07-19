// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../interfaces/IFundStrategy.sol";
import "../../interfaces/IFund.sol";
import "../../interfaces/ITranchedPool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract FixedLeverageRatioStrategy is IFundStrategy {
  using SafeMath for uint256;

  uint256 private leverageRatio;

  constructor(uint256 _leverageRatio) public {
    leverageRatio = _leverageRatio;
  }

  /**
   * @notice Determines how much money to invest in the senior tranche based on what is committed to the junior
   * tranche and a fixed leverage ratio to the junior. Idempotent.
   * @param fund The fund to invest from
   * @param pool The pool to invest into (as the senior)
   * @return The amount of money to invest into the pool from the fund
   */
  function invest(IFund fund, ITranchedPool pool) public view override returns (uint256) {
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
   * @param fund The fund to invest from
   * @param pool The pool to invest into (as the senior)
   * @return The amount of money to invest into the pool from the fund
   */
  function estimateInvestment(IFund fund, ITranchedPool pool) public view override returns (uint256) {
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
    uint256 seniorTarget = juniorCapital.mul(leverageRatio);

    if (existingSeniorCapital >= seniorTarget) {
      return 0;
    }

    return seniorTarget.sub(existingSeniorCapital);
  }
}
