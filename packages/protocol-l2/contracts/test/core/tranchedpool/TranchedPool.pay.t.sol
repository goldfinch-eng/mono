// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolPayTest is TranchedPoolBaseTest {
  function testRevertsIfPaymentEq0() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    vm.expectRevert(bytes("ZA"));
    pool.pay(0);
  }

  function testOnlyTakesWhatsNeededForExcessPayment(uint256 amount, uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalOwed = cl.interestOwed() + cl.interestAccrued() + cl.balance();
    amount = bound(amount, totalOwed, totalOwed * 10);

    fundAddress(address(this), amount);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(pool), amount);
    pool.pay(amount);

    // Balance should only decrease by the totalOwed, even if amount > totalOwed
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalOwed);
  }

  function testRevertsIfPoolJuniorTrancheIsUnlocked() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);

    fundAddress(address(this), usdcVal(1));
    usdc.approve(address(pool), usdcVal(1));
    vm.expectRevert(bytes("NL"));
    pool.pay(usdcVal(1));
  }

  function testRevertsIfPoolSeniorTrancheIsUnlocked() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);

    fundAddress(address(this), usdcVal(1));
    usdc.approve(address(pool), usdcVal(1));
    vm.expectRevert(bytes("NL"));
    pool.pay(usdcVal(1));
  }

  function testAcceptsPayment(uint256 amount, uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    timestamp = bound(timestamp, block.timestamp, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalOwed = cl.interestOwed() + cl.interestAccrued() + cl.balance();
    amount = bound(amount, usdcVal(1), totalOwed);

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();
    uint256 balanceBefore = cl.balance();

    fundAddress(address(this), amount);
    usdc.approve(address(pool), amount);
    ILoan.PaymentAllocation memory pa = pool.pay(amount);

    assertEq(cl.interestAccrued(), interestAccruedBefore - pa.accruedInterestPayment);
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
    assertEq(cl.balance(), balanceBefore - (pa.principalPayment + pa.additionalBalancePayment));
  }
}
