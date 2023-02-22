// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {BaseTest} from "../../core/BaseTest.t.sol";

contract AccountantBaseTest is BaseTest {
  uint private constant MAX_BALANCE = 100_000_000e6;
  uint private constant MIN_BALANCE = 1;
  uint private constant MAX_INTEREST = 100_000_000_000e6;

  struct Params {
    uint principalPayment;
    uint interestPayment;
    uint balance;
    uint interestOwed;
    uint interestAccrued;
    uint principalOwed;
  }

  function _allocatePaymentWithParams(
    Params memory p
  ) internal pure returns (ITranchedPool.PaymentAllocation memory) {
    return
      Accountant.allocatePayment({
        principalPayment: p.principalPayment,
        interestPayment: p.interestPayment,
        balance: p.balance,
        interestOwed: p.interestOwed,
        interestAccrued: p.interestAccrued,
        principalOwed: p.principalOwed
      });
  }

  modifier withParams(Params memory p) {
    _withParams(p);
    _;
  }

  function _withParams(Params memory p) internal virtual {
    vm.assume(p.balance >= MIN_BALANCE && p.balance <= MAX_BALANCE);
    vm.assume(p.interestOwed <= MAX_INTEREST);
  }
}
