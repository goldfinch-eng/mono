// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SaturatingSub} from "../../../../protocol/library/SaturatingSub.sol";
import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (intOwed = 0, intAccrued = 0, princOwed > 0)
 * Case 1 - all payment amounts are accepted
 */
contract TranchedPoolPaySeparateIntOwedEq0IntAccrEq0PrincOwedGt0 is TranchedPoolBaseTest {
  using SafeMathUpgradeable for uint256;

  function testAcceptsAllPaymentAmounts(
    uint256 intPayment,
    uint256 princPayment,
    uint256 numPeriodsToAdvance
  ) public {
    (TranchedPool tp, CreditLine cl) = tranchedPoolWithMonthlyPrincipalSchedule();
    deposit(tp, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(tp);
    seniorDepositAndInvest(tp, usdcVal(400));
    lockSeniorTranche(tp);
    drawdown(tp, usdcVal(500));

    fundAddress(address(this), usdcVal(2000));
    usdc.approve((address(tp)), usdcVal(2000));

    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 12);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    // Pay off all owed interest
    tp.pay(0, cl.interestOwed());
    assertZero(cl.interestOwed(), "no more interest owed");
    assertZero(cl.interestAccrued(), "no more interest accrued");
    assertTrue(cl.principalOwed() > 0, "there is still principal owed");

    intPayment = bound(intPayment, 0, usdcVal(1000));
    princPayment = bound(princPayment, 1, usdcVal(1000));

    uint256 princOwed = cl.principalOwed();
    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertZero(pa.owedInterestPayment);
    assertZero(pa.accruedInterestPayment);
    uint256 princOwedPayment = Math.min(princOwed, princPayment);
    assertEq(pa.principalPayment, princOwedPayment);
    uint256 remainingPayment = Math.min(princPayment, usdcVal(500)).saturatingSub(princOwed);
    assertEq(pa.additionalBalancePayment, remainingPayment);
    assertZero(pa.paymentRemaining);
  }
}
