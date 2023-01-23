// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract TranchedPoolPaySeparateTest is CallableLoanBaseTest {
  function testRevertsIfPaymentEq0() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    vm.expectRevert(bytes("ZA"));
    pool.pay(0, 0);
  }

  function testOnlyTakesWhatsNeededForExcessInterestPayment(
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, totalIntOwed, totalIntOwed * 10);

    fundAddress(address(this), interestAmount);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(pool), interestAmount);
    pool.pay(0, interestAmount);

    // Balance should only decrease by total interest owed even if that is less than the amount paid
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalIntOwed);
  }

  function testOnlyTakesWhatsNeededForExcessInterestAndPrincipalPayment(
    uint256 principalAmount,
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, totalIntOwed, totalIntOwed * 10);

    uint256 totalPrincipalOwed = cl.balance();
    principalAmount = bound(principalAmount, totalPrincipalOwed, totalPrincipalOwed * 10);

    uint256 totalOwed = totalIntOwed + totalPrincipalOwed;

    fundAddress(address(this), totalOwed);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(pool), totalOwed);
    pool.pay(principalAmount, interestAmount);

    // Balance should only decrease by total  owed even if that is less than the amount paid
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalOwed);
  }

  function testRevertsIfPoolJuniorTrancheIsUnlocked() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);

    fundAddress(address(this), usdcVal(1));
    usdc.approve(address(pool), usdcVal(1));
    vm.expectRevert(bytes("NL"));
    pool.pay(0, usdcVal(1));
  }

  function testRevertsIfPoolSeniorTrancheIsUnlocked() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);

    fundAddress(address(this), usdcVal(1));
    usdc.approve(address(pool), usdcVal(1));
    vm.expectRevert(bytes("NL"));
    pool.pay(0, usdcVal(1));
  }

  function testRevertsIfPrincipalAmountGt0AndInterstAmountLtTotalInterestOwed(
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    interestAmount = bound(interestAmount, 1, cl.interestOwed() + cl.interestAccrued() - 1);
    principalAmount = bound(principalAmount, 1, cl.balance());

    fundAddress(address(this), interestAmount + principalAmount);
    usdc.approve(address(pool), interestAmount + principalAmount);

    vm.expectRevert(bytes("II"));
    pool.pay(principalAmount, interestAmount);
  }

  function testAcceptsPaymentUpToTotalInterestOwed(
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, 1, totalIntOwed);

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();

    fundAddress(address(this), interestAmount);
    usdc.approve(address(pool), interestAmount);
    ILoan.PaymentAllocation memory pa = pool.pay(0, interestAmount);

    assertEq(cl.interestAccrued(), interestAccruedBefore - pa.accruedInterestPayment);
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
  }

  function testAcceptsPaymentUpToTotalInterestAndPrincipalOwed(
    uint256 principalAmount,
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    principalAmount = bound(principalAmount, 0, cl.balance());

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();
    uint256 balanceBefore = cl.balance();

    fundAddress(address(this), totalIntOwed + principalAmount);
    usdc.approve(address(pool), totalIntOwed + principalAmount);
    ILoan.PaymentAllocation memory pa = pool.pay(principalAmount, totalIntOwed);

    assertEq(cl.interestAccrued(), interestAccruedBefore - pa.accruedInterestPayment);
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
    assertEq(cl.balance(), balanceBefore - (pa.principalPayment + pa.additionalBalancePayment));
  }
}
