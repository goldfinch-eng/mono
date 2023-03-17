// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {FixedLeverageRatioStrategyBaseTest} from "./FixedLeverageRatioStrategyBase.t.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

contract FixedLeverageRatioStrategyEstimateInvestmentTest is FixedLeverageRatioStrategyBaseTest {
  function testLeversJuniorAmountUsingRatio(uint256 juniorAmount) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    uint256 expectedSeniorInvestment = juniorAmount * 4;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversJuniorAmountUsingFractionalRatio(
    uint256 juniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    (TranchedPool tp, ) = defaultTranchedPool();

    // Set leverage ratio to 3.5
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LeverageRatio), (1e18 * 3) / 2);

    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    uint256 expectedSeniorInvestment = (juniorAmount * 3) / 2;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversJuniorAmountIfJuniorAndSeniorTranchesUnlocked(
    uint256 juniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    uint256 expectedSeniorInvestment = juniorAmount * 4;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversJuniorAmountIfSeniorTrancheIsUnlocked(
    uint256 juniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    lockJuniorCap(tp);

    uint256 expectedSeniorInvestment = juniorAmount * 4;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversJuniorAmountIfAllTranchesLocked(
    uint256 juniorAmount,
    uint256 seniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    seniorAmount = bound(seniorAmount, usdcVal(1), juniorAmount * 4);
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    lockJuniorCap(tp);
    // Grant senior role to gf owner so it can deposit in the senior tranch
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    usdc.approve(address(tp), seniorAmount);
    tp.deposit(uint256(ITranchedPool.Tranches.Senior), seniorAmount);
    lock(tp);

    uint256 expectedSeniorInvestment = juniorAmount * 4 - seniorAmount;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversJuniorAmountIfSeniorTrancheHasCapital(
    uint256 juniorAmount,
    uint256 seniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    seniorAmount = bound(seniorAmount, usdcVal(1), juniorAmount * 4);
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    lockJuniorCap(tp);
    // Grant senior role to gf owner so it can deposit in the senior tranch
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    usdc.approve(address(tp), seniorAmount);
    tp.deposit(uint256(ITranchedPool.Tranches.Senior), seniorAmount);

    uint256 expectedSeniorInvestment = juniorAmount * 4 - seniorAmount;
    assertEq(fixedStrat.estimateInvestment(sp, tp), expectedSeniorInvestment);
  }

  function testLeversZeroIfSeniorAmountExceedsMaxLeverage(
    uint256 juniorAmount,
    uint256 seniorAmount
  ) public impersonating(GF_OWNER) {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(10_000_000));
    seniorAmount = bound(seniorAmount, juniorAmount * 4, juniorAmount * 10);
    (TranchedPool tp, ) = defaultTranchedPool();
    depositToTpFrom(tp, GF_OWNER, juniorAmount);
    lockJuniorCap(tp);
    // Grant senior role to gf owner so it can deposit in the senior tranch
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    usdc.approve(address(tp), seniorAmount);
    tp.deposit(uint256(ITranchedPool.Tranches.Senior), seniorAmount);

    assertZero(fixedStrat.estimateInvestment(sp, tp));
  }
}
