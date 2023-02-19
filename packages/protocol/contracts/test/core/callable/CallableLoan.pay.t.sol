// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";

contract CallableLoanPayTest is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  function testRevertsIfPaymentEq0() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    vm.expectRevert(bytes("ZA"));
    callableLoan.pay(0);
  }

  function testOnlyTakesWhatsNeededForExcessPayment(uint256 amount, uint256 timestamp) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    timestamp = bound(timestamp, block.timestamp, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalOwed = cl.interestOwed() + cl.interestAccrued() + cl.balance();
    amount = bound(amount, totalOwed, totalOwed * 10);

    fundAddress(address(this), amount);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(callableLoan), amount);
    callableLoan.pay(amount);

    // Balance should only decrease by the totalOwed, even if amount > totalOwed
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalOwed);
  }

  function testRevertsIfStillInFundingStage() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();

    fundAddress(address(this), usdcVal(1));
    usdc.approve(address(callableLoan), usdcVal(1));
    vm.expectRevert(bytes("NA"));
    callableLoan.pay(usdcVal(1));
  }

  function testAcceptsPayment(uint256 amount, uint256 timestamp) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    timestamp = bound(timestamp, block.timestamp, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalOwed = cl.interestOwed() + cl.interestAccrued() + cl.balance();
    amount = bound(amount, usdcVal(1), totalOwed);

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();
    uint256 balanceBefore = cl.balance();

    fundAddress(address(this), amount);
    usdc.approve(address(callableLoan), amount);
    ILoan.PaymentAllocation memory pa = callableLoan.pay(amount);
    assertEq(
      cl.interestAccrued(),
      interestAccruedBefore.saturatingSub(pa.accruedInterestPayment),
      "accrued"
    );
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment, "owed");
    assertEq(
      cl.balance(),
      balanceBefore - (pa.principalPayment + pa.additionalBalancePayment),
      "balance"
    );
  }
}
