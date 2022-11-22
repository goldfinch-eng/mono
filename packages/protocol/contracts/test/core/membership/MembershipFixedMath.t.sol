// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import {Test, stdError} from "forge-std/Test.sol";

import {MembershipFixedMath} from "../../../protocol/core/membership/MembershipFixedMath.sol";
import {FixedMath0x} from "../../../protocol/core/membership/FixedMath0x.sol";

contract MembershipFixedMathTest is Test {
  int256 private one = MembershipFixedMath.toFixed(1, 1);
  int256 private threeFourths = MembershipFixedMath.toFixed(3, 4);
  int256 private oneHalf = MembershipFixedMath.toFixed(1, 2);
  int256 private oneThird = MembershipFixedMath.toFixed(1, 3);
  int256 private oneFourth = MembershipFixedMath.toFixed(1, 4);
  int256 private oneFifth = MembershipFixedMath.toFixed(1, 5);

  function test_toFixed_numeratorTooLarge() public {
    vm.expectRevert(stdError.arithmeticError);
    MembershipFixedMath.toFixed(uint256(type(int256).max + 1), 1);

    vm.expectRevert(stdError.arithmeticError);
    MembershipFixedMath.toFixed(type(uint256).max, 1);
  }

  function test_toFixed_numeratorConversionOverflow() public {
    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.toFixed(uint256(type(int256).max) + 1, 2);

    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.toFixed(2, uint256(type(int256).max) + 1);
  }

  function test_toFixed_denominatorTooLarge() public {
    vm.expectRevert(stdError.arithmeticError);
    MembershipFixedMath.toFixed(1, uint256(type(int256).max + 1));

    vm.expectRevert(stdError.arithmeticError);
    MembershipFixedMath.toFixed(1, type(uint256).max);
  }

  function test_toFixed_divByZero() public {
    vm.expectRevert(stdError.divisionError);
    MembershipFixedMath.toFixed(0, 0);
  }

  function test_toFixed_notFraction() public {
    vm.expectRevert(abi.encodeWithSelector(MembershipFixedMath.InvalidFraction.selector, 4, 2));
    MembershipFixedMath.toFixed(4, 2);
  }

  function test_uintDiv_conversionOverflow() public {
    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.uintDiv(uint256(type(int256).max) + 1, 2);

    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.uintDiv(uint256(type(int256).max), 1);
  }

  function test_uintDiv_divByZero() public {
    vm.expectRevert(stdError.divisionError);
    MembershipFixedMath.uintDiv(1, 0);
  }

  function test_uintDiv(uint128 amount) public {
    vm.assume(amount < 1e29);

    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, one), amount, 10);
    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, threeFourths), (amount * 4) / 3, 10);
    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, oneHalf), amount * 2, 10);
    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, oneThird), amount * 3, 10);
    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, oneFourth), amount * 4, 10);
    assertApproxEqAbs(MembershipFixedMath.uintDiv(amount, oneFifth), amount * 5, 10);
  }

  function test_uintMul_conversionOverflow() public {
    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.uintMul(uint256(type(int256).max) + 1, 2);

    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipFixedMath.uintMul(type(uint256).max, 1);
  }

  function test_uintMul(uint128 amount) public {
    vm.assume(amount < 1e29);

    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, one), amount, 10);
    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, threeFourths), (amount * 3) / 4, 10);
    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, oneHalf), amount / 2, 10);
    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, oneThird), amount / 3, 10);
    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, oneFourth), amount / 4, 10);
    assertApproxEqAbs(MembershipFixedMath.uintMul(amount, oneFifth), amount / 5, 10);
  }
}
