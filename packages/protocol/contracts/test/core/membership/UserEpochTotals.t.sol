// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {UserEpochTotal, UserEpochTotals} from "../../../protocol/core/membership/UserEpochTotals.sol";
import "../../../protocol/core/membership/Epochs.sol";

import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";

using UserEpochTotals for UserEpochTotal;

contract UserEpochTotalsTest is Test {
  UserEpochTotal private total;

  function setUp() public {
    total = UserEpochTotal(0, 0, 0);
  }

  function test_recordIncrease() public {
    total.recordIncrease(1);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 1);

    vm.warp(Epochs.EPOCH_SECONDS);

    (current, next) = total.getTotals();

    assertEq(current, 1);
    assertEq(next, 1);
  }

  function test_recordDecrease_currentEpochDeposit() public {
    total.recordIncrease(2);
    total.recordDecrease(1, block.timestamp);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 1);

    total.recordDecrease(1, block.timestamp);

    (current, next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 0);
  }

  function test_recordDecrease_previousEpochDeposit() public {
    total.recordIncrease(2);

    vm.warp(Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 2);
    assertEq(next, 2);

    total.recordDecrease(1, 0);

    (current, next) = total.getTotals();

    assertEq(current, 1);
    assertEq(next, 1);
  }

  function test_recordDecrease_futureEpoch() public {
    total.recordIncrease(2);

    vm.warp(Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 2);
    assertEq(next, 2);

    vm.expectRevert(abi.encodeWithSelector(UserEpochTotals.InvalidDepositEpoch.selector, Epochs.next()));
    total.recordDecrease(1, Epochs.next() * Epochs.EPOCH_SECONDS);
  }
}
