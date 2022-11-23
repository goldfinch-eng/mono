// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";

import "../../protocol/core/membership/Epochs.sol";

contract EpochsTest is Test {
  function test_toTimestamp() public {
    assertEq(Epochs.currentEpochStartTimestamp(), 0);

    vm.warp(Epochs.EPOCH_SECONDS);
    assertEq(Epochs.currentEpochStartTimestamp(), Epochs.EPOCH_SECONDS);

    vm.warp(100 * Epochs.EPOCH_SECONDS + Epochs.EPOCH_SECONDS / 3);
    assertEq(Epochs.currentEpochStartTimestamp(), 100 * Epochs.EPOCH_SECONDS);
  }

  function test_fromSeconds() public {
    assertEq(Epochs.fromSeconds(0), 0);
    assertEq(Epochs.fromSeconds(1), 0);
    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS - 1), 0);

    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS), 1);
    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS + 1), 1);
    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS * 2 - 1), 1);

    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS * 2), 2);
    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS * 2 + 1), 2);
    assertEq(Epochs.fromSeconds(Epochs.EPOCH_SECONDS * 3 - 1), 2);
  }

  function test_current() public {
    assertEq(Epochs.current(), 0);
    assertEq(Epochs.next(), 1);

    vm.warp(1);
    assertEq(Epochs.current(), 0);
    assertEq(Epochs.next(), 1);

    vm.warp(Epochs.EPOCH_SECONDS - 1);
    assertEq(Epochs.current(), 0);
    assertEq(Epochs.next(), 1);

    vm.warp(Epochs.EPOCH_SECONDS);
    assertEq(Epochs.current(), 1);
    assertEq(Epochs.previous(), 0);
    assertEq(Epochs.next(), 2);

    vm.warp(Epochs.EPOCH_SECONDS + 1);
    assertEq(Epochs.current(), 1);
    assertEq(Epochs.previous(), 0);
    assertEq(Epochs.next(), 2);

    vm.warp(Epochs.EPOCH_SECONDS * 2 - 1);
    assertEq(Epochs.current(), 1);
    assertEq(Epochs.previous(), 0);
    assertEq(Epochs.next(), 2);

    vm.warp(Epochs.EPOCH_SECONDS * 2);
    assertEq(Epochs.current(), 2);
    assertEq(Epochs.previous(), 1);
    assertEq(Epochs.next(), 3);
  }
}
