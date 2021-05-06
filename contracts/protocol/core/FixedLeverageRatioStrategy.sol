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

  function invest(IFund fund, ITranchedPool pool) public view override returns (uint256) {
    ITranchedPool.TrancheInfo memory juniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Junior));
    ITranchedPool.TrancheInfo memory seniorTranche = pool.getTranche(uint256(ITranchedPool.Tranches.Senior));

    if (juniorTranche.lockedAt == 0 || seniorTranche.lockedAt > 0) {
      return 0;
    }

    uint256 juniorCapital = juniorTranche.principalDeposited;
    uint256 existingSeniorCapital = seniorTranche.principalDeposited;
    uint256 seniorTarget = juniorCapital.mul(leverageRatio);

    if (existingSeniorCapital >= seniorTarget) {
      return 0;
    }

    return seniorTarget.sub(existingSeniorCapital);
  }
}
