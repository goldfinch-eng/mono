// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

import {FixedLeverageRatioStrategyBaseTest} from "./FixedLeverageRatioStrategyBase.t.sol";

contract FixedLeverageRatioStrategyTest is FixedLeverageRatioStrategyBaseTest {
  function testGetLeverageRatioReturnsLeverageRatioInGfConfig(ITranchedPool pool) public {
    assertEq(fixedStrat.getLeverageRatio(pool), 4e18);
  }
}
