// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {UserEpochTotal, UserEpochTotals} from "../../../protocol/core/membership/UserEpochTotals.sol";
import "../../../protocol/core/membership/Epochs.sol";

import {Test} from "forge-std/Test.sol";

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

  function test_recordInstantIncrease() public withDeposit(2) {
    total.recordInstantIncrease(1, block.timestamp);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 3);
  }

  function test_recordInstantIncrease_noExistingPosition() public {
    total.recordInstantIncrease(1, block.timestamp);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 1);
  }

  function test_recordInstantIncrease_noExistingPosition_previousEpochDeposit() public {
    vm.warp(Epochs.EPOCH_SECONDS);

    total.recordInstantIncrease(1, block.timestamp - Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 1);
    assertEq(next, 1);
  }

  function test_recordInstantIncrease_previousEpochDeposit() public withDeposit(2) {
    vm.warp(Epochs.EPOCH_SECONDS);

    total.recordInstantIncrease(1, block.timestamp - Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 3);
    assertEq(next, 3);
  }

  function test_recordInstantIncrease_futureEpoch() public withDeposit(2) {
    vm.expectRevert(
      abi.encodeWithSelector(UserEpochTotals.InvalidDepositEpoch.selector, Epochs.next())
    );
    total.recordInstantIncrease(1, Epochs.next() * Epochs.EPOCH_SECONDS);
  }

  function test_recordDecrease_currentEpochDeposit() public withDeposit(2) {
    total.recordDecrease(1, block.timestamp);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 1);

    total.recordDecrease(1, block.timestamp);

    (current, next) = total.getTotals();

    assertEq(current, 0);
    assertEq(next, 0);
  }

  function test_recordDecrease_previousEpochDeposit() public withDeposit(2) {
    vm.warp(Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 2);
    assertEq(next, 2);

    total.recordDecrease(1, 0);

    (current, next) = total.getTotals();

    assertEq(current, 1);
    assertEq(next, 1);
  }

  function test_recordDecrease_futureEpoch() public withDeposit(2) {
    vm.warp(Epochs.EPOCH_SECONDS);

    (uint256 current, uint256 next) = total.getTotals();

    assertEq(current, 2);
    assertEq(next, 2);

    vm.expectRevert(
      abi.encodeWithSelector(UserEpochTotals.InvalidDepositEpoch.selector, Epochs.next())
    );
    total.recordDecrease(1, Epochs.next() * Epochs.EPOCH_SECONDS);
  }

  modifier withDeposit(uint256 amount) {
    total.recordIncrease(amount);
    _;
  }
}
