// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (intOwed = 0, intAccrued = 0, princOwed = 0)
 * Case 1 - all payment amounts are accepted
 */
contract TranchedPoolPaySeparateIntOwedEq0IntAccrEq0PrincOwedEq0 is TranchedPoolBaseTest {
  function testAcceptsAllPaymentAmounts(uint256 intPayment, uint256 princPayment) public {
    (TranchedPool tp, CreditLine cl) = defaultTranchedPool();
    deposit(tp, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(tp);
    seniorDepositAndInvest(tp, usdcVal(400));
    lockSeniorTranche(tp);
    drawdown(tp, usdcVal(500));

    fundAddress(address(this), usdcVal(2000));
    usdc.approve((address(tp)), usdcVal(2000));

    intPayment = bound(intPayment, 0, usdcVal(1000));
    princPayment = bound(princPayment, 1, usdcVal(1000));

    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());
    assertZero(cl.principalOwed());

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertZero(pa.owedInterestPayment);
    assertZero(pa.accruedInterestPayment);
    assertZero(pa.principalPayment);
    assertEq(pa.additionalBalancePayment, Math.min(princPayment, usdcVal(500)));
    assertZero(pa.paymentRemaining);
  }
}
