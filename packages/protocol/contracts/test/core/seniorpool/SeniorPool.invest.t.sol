// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

contract SeniorPoolInvestTest is SeniorPoolBaseTest {
  function testInvestRevertsForInvalidPool() public {
    TestTranchedPool tp = new TestTranchedPool();
    uint256[] memory ids = new uint256[](1);
    tp.initialize(address(gfConfig), GF_OWNER, 1, 1, 1, 1, 1, 1, 1, block.timestamp, ids);
    vm.expectRevert("Pool must be valid");
    sp.invest(tp);
  }

  function testInvestCallableByAnyone(uint256 juniorAmount, address user) public {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    depositToSpFrom(GF_OWNER, sp.estimateInvestment(tp));

    _startImpersonation(user);
    sp.invest(tp);
    _stopImpersonation();
  }

  function testInvestWorksWhenSeniorTrancheNonEmpty(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    tp._setSeniorTranchePrincipalDeposited(usdcVal(1));
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    sp.invest(tp);

    assertEq(
      tp.getTranche((uint256(ITranchedPool.Tranches.Senior))).principalDeposited,
      investmentAmount + usdcVal(1)
    );
  }

  function testInvestDepositsToSeniorTranche(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);
    sp.invest(tp);
    assertEq(
      tp.getTranche((uint256(ITranchedPool.Tranches.Senior))).principalDeposited,
      investmentAmount
    );
  }

  function testInvestEmitsInvestmentMadeInSeniorEvent(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    vm.expectEmit(true, false, false, true);
    emit InvestmentMadeInSenior(address(tp), investmentAmount);

    sp.invest(tp);
  }

  function testInvestCountsInvestmentAmountInAssets(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    assertEq(sp.usdcAvailable(), investmentAmount);
    assertZero(sp.totalLoansOutstanding());
    assertEq(sp.assets(), investmentAmount);

    sp.invest(tp);

    assertZero(sp.usdcAvailable());
    assertEq(sp.totalLoansOutstanding(), investmentAmount);
    assertEq(sp.assets(), investmentAmount);
  }

  function testInvestRevertsForZeroInvestmentAmount() public {
    (TestTranchedPool tp, ) = defaultTp();
    lockJuniorCap(tp);

    vm.expectRevert("Investment amount must be positive");
    sp.invest(tp);
  }

  function testInvestDecreasesUsdcAvailable(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    assertEq(sp.usdcAvailable(), investmentAmount);
    sp.invest(tp);
    assertZero(sp.usdcAvailable());
  }

  function testInvestLiquidatesEpochIfOneOrMoreEpochsHaveEnded(
    address user,
    uint256 epochsElapsed
  ) public goListed(user) tokenApproved(user) {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    epochsElapsed = bound(epochsElapsed, 1, 10);
    uint256 juniorAmount = usdcVal(100);
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    uint256 investmentShares = depositToSpFrom(GF_OWNER, investmentAmount);

    // Request to take out half
    fundAddress(user, usdcVal(100));
    uint256 shares = depositToSpFrom(user, usdcVal(100));
    requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    uint256 fiduSupplyBefore = fidu.totalSupply();
    assertEq(fiduSupplyBefore, investmentShares + shares);
    sp.invest(tp);
    // Fidu should have been burned as a result of the liquidation
    assertEq(fidu.totalSupply(), investmentShares);
  }

  function testInvestCannotInvestMoreThanUsdcAvailableEvenIfUsdcBalanceExceedsUsdcAvailable(
    uint256 juniorAmount
  ) public {
    juniorAmount = bound(juniorAmount, usdcVal(2), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    uint256 investmentShares = depositToSpFrom(GF_OWNER, investmentAmount);

    // Request to take out half
    requestWithdrawalFrom(GF_OWNER, investmentShares / 2);

    vm.warp(block.timestamp + sp.epochDuration());

    // Half of the investment $ is allocated to the withdrawal request, and the sp no longer has
    // enough usdc available to invest
    assertEq(usdc.balanceOf(address(sp)), investmentAmount);
    assertEq(sp.usdcAvailable(), investmentAmount / 2);

    vm.expectRevert("not enough usdc");
    sp.invest(tp);
  }
}
