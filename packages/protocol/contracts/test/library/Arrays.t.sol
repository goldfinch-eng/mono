// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import {Arrays} from "../../library/Arrays.sol";
import {Test} from "forge-std/Test.sol";

using Arrays for uint256[];

contract ArraysTest is Test {
  uint256[] private array;

  function test_remove_oneItem() public {
    array.push(1);

    (uint256 length, bool replaced) = array.reorderingRemove(0);

    assertEq(length, 0);
    assertFalse(replaced);
  }

  function test_remove_lastIndex() public {
    array.push(1);
    array.push(2);

    (uint256 length, bool replaced) = array.reorderingRemove(1);

    assertEq(length, 1);
    assertFalse(replaced);

    assertEq(array[0], 1);
    assertEq(array.length, 1);
  }

  function test_remove_index() public {
    array.push(1);
    array.push(2);

    (uint256 length, bool replaced) = array.reorderingRemove(0);

    assertEq(length, 1);
    assertTrue(replaced);

    assertEq(array[0], 2);
    assertEq(array.length, 1);
  }
}
