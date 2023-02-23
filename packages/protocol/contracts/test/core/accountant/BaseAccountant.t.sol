// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {BaseTest} from "../../core/BaseTest.t.sol";
import {TestCreditLine} from "../../../test/TestCreditLine.sol";

contract AccountantBaseTest is BaseTest {
  

  modifier withLateFeeApr(TestCreditLine cl, uint256 _lateFeeApr) {
    cl.setLateFeeApr(_lateFeeApr);
    _;
  }

  modifier withInterestApr(TestCreditLine cl, uint256 _interestApr) {
    cl.setInterestApr(_interestApr);
    _;
  }

  // modifier withNextDueTime(TestCreditLine cl, uint256 _nextDueTime) {
  //   cl.setNextDueTime(_nextDueTime);
  //   _;
  // }

  // modifier withInterestOwed(TestCreditLine cl, uint256 _interestOwed) {
  //   cl.setInterestOwed(_interestOwed);
  //   _;
  // }
}
