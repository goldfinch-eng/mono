// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {TestSeniorPoolCaller} from "../../../test/TestSeniorPoolCaller.sol";
import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract SeniorPoolTest is SeniorPoolBaseTest {
  /*================================================================================
  getNumShares
  ================================================================================*/

  function testGetNumSharesCalculatesSharesBasedOnSharePrice(
    uint256 amount,
    uint256 sharePrice
  ) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    sharePrice = bound(sharePrice, fiduVal(1) / 2, fiduVal(2));
    sp._setSharePrice(sharePrice);
    uint256 expectedNumShares = (((amount * 1e18) / 1e6) * 1e18) / sp.sharePrice();
    assertEq(expectedNumShares, sp.getNumShares(amount));
  }

  /*================================================================================
  withdrawalRequest view tests
  ================================================================================*/

  function testWithdrawalRequestReturnsCorrectFiduRequestedAndUsdcWithdrawable(
    address user1,
    address user2
  ) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, fiduVal(1000));
    requestWithdrawalFrom(user2, fiduVal(3000));

    // Invest in a tranched pool to suck up the $4000 liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);
    assertZero(sp.usdcAvailable());

    // Make a $500 deposit in epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Make a $350 deposit
    depositToSpFrom(GF_OWNER, usdcVal(350));

    vm.warp(block.timestamp + sp.epochDuration());

    // In epoch 1 we had $500/$4000 fulfilled = 12.5%
    // In epoch 2 we had $350/$3500 fulfilled = 10%

    // Do user 1
    uint256 usdcEpoch1 = (usdcVal(1000) * 125) / 1000;
    uint256 usdcEpoch2 = ((usdcVal(1000) - usdcEpoch1) * 10) / 100;
    uint256 fiduEpoch1 = (fiduVal(1000) * 125) / 1000;
    uint256 fiduEpoch2 = ((fiduVal(1000) - fiduEpoch1) * 10) / 100;
    assertEq(sp.withdrawalRequest(1).usdcWithdrawable, usdcEpoch1 + usdcEpoch2);
    assertEq(sp.withdrawalRequest(1).fiduRequested, fiduVal(1000) - fiduEpoch1 - fiduEpoch2);

    // Do user 2
    usdcEpoch1 = (usdcVal(3000) * 125) / 1000;
    usdcEpoch2 = ((usdcVal(3000) - usdcEpoch1) * 10) / 100;
    fiduEpoch1 = (fiduVal(3000) * 125) / 1000;
    fiduEpoch2 = ((fiduVal(3000) - fiduEpoch1) * 10) / 100;
    assertEq(sp.withdrawalRequest(2).usdcWithdrawable, usdcEpoch1 + usdcEpoch2);
    assertEq(sp.withdrawalRequest(2).fiduRequested, fiduVal(3000) - fiduEpoch1 - fiduEpoch2);
  }

  /*================================================================================
  currentEpoch
  ================================================================================*/

  function testCurrentEpochReturnsCurrentEpoch() public {
    assertZero(sp.currentEpoch().fiduRequested);
    assertZero(sp.currentEpoch().fiduLiquidated);
    assertZero(sp.currentEpoch().usdcAllocated);

    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(100));
    requestWithdrawalFrom(GF_OWNER, shares / 2);

    assertEq(sp.currentEpoch().fiduRequested, shares / 2, "1");
    assertZero(sp.currentEpoch().fiduLiquidated, "2");
    assertZero(sp.currentEpoch().usdcAllocated, "3");

    uint256 oldEndsAt = sp.currentEpoch().endsAt;
    vm.warp(block.timestamp + sp.epochDuration());

    assertZero(sp.currentEpoch().fiduRequested);
    assertZero(sp.currentEpoch().fiduLiquidated);
    assertZero(sp.currentEpoch().usdcAllocated);
    assertEq(sp.currentEpoch().endsAt, oldEndsAt + sp.epochDuration());
  }

  /*================================================================================
  Pool Assets 
  ================================================================================*/

  function testPoolAssetsDoesntIncludeUsdcAllocatedFroWithdrawals(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    requestWithdrawalFrom(user, shares);
    assertEq(sp.assets(), amount);
    vm.warp(block.timestamp + sp.epochDuration());
    assertZero(sp.assets());
  }

  function testPoolAssetsDoesntDecreaseOnClaimWithdrawalRequest(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
  )
    public
    onlyAllowListed(user1)
    onlyAllowListed(user2)
    goListed(user1)
    goListed(user2)
    tokenApproved(user1)
    tokenApproved(user2)
  {
    vm.assume(user1 != user2);
    amount1 = bound(amount1, usdcVal(1), usdcVal(10_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user1, amount1);
    fundAddress(user2, amount2);
    uint256 shares1 = depositToSpFrom(user1, amount1);
    uint256 token1 = requestWithdrawalFrom(user1, shares1);
    assertEq(sp.assets(), amount1);
    vm.warp(block.timestamp + sp.epochDuration());
    uint256 shares2 = depositToSpFrom(user2, amount2);
    requestWithdrawalFrom(user2, shares2);
    assertEq(sp.assets(), amount2);
    claimWithdrawalRequestFrom(user1, token1);
    // Assets should be unchanged even after user1 takes their usdc allocated out
    assertEq(sp.assets(), amount2);
  }

  /*================================================================================
  Shares Outstanding 
  ================================================================================*/

  function testSharesOutstandingIncludesNewlyMintedFidu(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    assertZero(sp.sharesOutstanding());
    uint256 shares = depositToSpFrom(GF_OWNER, amount);
    assertEq(sp.sharesOutstanding(), shares);
  }

  function testSharesOustandingExcludesVirtuallyBurnedFidu(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    uint256 shares = depositToSpFrom(GF_OWNER, amount);
    assertEq(sp.sharesOutstanding(), shares);
    requestWithdrawalFrom(GF_OWNER, shares);
    assertEq(sp.sharesOutstanding(), shares);
    vm.warp(block.timestamp + sp.epochDuration());
    // Although FIDU hasn't actually been burned yet it should be excluded from shares outstanding
    assertZero(sp.sharesOutstanding());
  }

  /*================================================================================
  Assets Matching Liabilities
  ================================================================================*/

  function testAssetLiabilityMismatchShouldPreventNewFiduMintsWhenMismatchExceedsThreshold()
    public
  {
    // TODO - fuzzed inputs
    depositToSpFrom(GF_OWNER, usdcVal(1));
    // Difference in share price must be enough to exceed the asset/liability mismatch threshold
    sp._setSharePrice(sp.sharePrice() * 3);
    vm.expectRevert("Cannot mint: it would create an asset/liability mismatch");
    depositToSpFrom(GF_OWNER, usdcVal(1));
  }

  function testAssetLiabilityMismatchShouldAllowNewFiduMintsWhenMismatchUnderThreshold() public {
    // TODO - fuzzed inputs
    depositToSpFrom(GF_OWNER, usdcVal(1));
    // This share price will cause a rounding error of 1 atomic unit.
    sp._setSharePrice(uint256(123456789) * uint256(1e8));
    uint256 fiduBefore = fidu.balanceOf(GF_OWNER);
    depositToSpFrom(GF_OWNER, usdcVal(1));
    assertTrue(fidu.balanceOf(GF_OWNER) > fiduBefore);
  }

  /*================================================================================
  Helper functions
  ================================================================================*/

  function testFiduMantissaShouldHave18Decimals() public {
    assertEq(sp.fiduMantissa(), 1e18);
  }

  function testUsdcMantissaShouldHave6Decimals() public {
    assertEq(sp.usdcMantissa(), 1e6);
  }

  function testUsdcToFiduAddsCorrectDecimalsToUsdc(uint256 usdcAmount) public {
    usdcAmount = bound(usdcAmount, usdcVal(1), usdcVal(10_000_000));
    assertEq(sp.usdcToFidu(usdcAmount), usdcAmount * 1e12);
  }

  /*================================================================================
  Estimate Investment
  ================================================================================*/

  function testEstimateInvestmentRevertsForInvalidPool() public {
    TestTranchedPool tp = new TestTranchedPool();
    uint256[] memory ids = new uint256[](1);
    // TODO(will)
    // tp.initialize(address(gfConfig), GF_OWNER, 1, 1, 1, 1, 1, 1, 1, block.timestamp, ids);
    vm.expectRevert("Pool must be valid");
    sp.estimateInvestment(tp);
  }

  function testEstimateInvestmentReturnsStrategysInvestmentAmount(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    // Should use the 4x leverage strategy
    assertEq(sp.estimateInvestment(tp), 4 * juniorAmount);
  }
}
