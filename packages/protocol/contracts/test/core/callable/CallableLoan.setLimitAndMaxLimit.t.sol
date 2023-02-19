// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSetLimitAndMaxLimitTest is CallableLoanBaseTest {
  function testSetLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(bytes("US"));
    callableLoan.setLimit(limit);
  }

  function testSetMaxLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(bytes("US"));
    callableLoan.setMaxLimit(limit);
  }
}
