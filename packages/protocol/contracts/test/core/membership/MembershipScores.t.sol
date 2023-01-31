// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import "forge-std/StdJson.sol";

import {MembershipScores} from "../../../protocol/core/membership/MembershipScores.sol";

using stdJson for string;

contract MembershipScoresTest is Test {
  struct TestCase {
    uint256 gfi;
    uint256 capital;
    uint256 expectedOutput;
  }

  function test_calculateScore_failUintConversion() public {
    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipScores.calculateScore(
      1 * 1e18,
      2 * 1e6,
      uint256(type(int256).max) + 1,
      uint256(type(int256).max) + 2
    );

    vm.expectRevert("SafeCast: value doesn't fit in an int256");
    MembershipScores.calculateScore(1 * 1e18, 2 * 1e6, 1, type(uint256).max);
  }

  function test_calculateScore_base() public {
    // Test basic arguments to ensure everything is as expected

    assertEq(MembershipScores.calculateScore(0 * 1e18, 0 * 1e6, 1, 2), 0);
    assertEq(MembershipScores.calculateScore(0 * 1e18, 1 * 1e6, 1, 2), 0);
    assertEq(MembershipScores.calculateScore(1 * 1e18, 0 * 1e6, 1, 2), 0);
    assertEq(MembershipScores.calculateScore(1 * 1e18, 1 * 1e6, 1, 2), 1 * 1e18);
    assertEq(MembershipScores.calculateScore(2 * 1e18, 2 * 1e6, 1, 2), 2 * 1e18);
    assertEq(MembershipScores.calculateScore(3 * 1e18, 3 * 1e6, 1, 2), 3 * 1e18);
    assertApproxEqAbs(
      MembershipScores.calculateScore(1 * 1e18, 2 * 1e6, 1, 2),
      1414213562373000000,
      1e6
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(2 * 1e18, 1 * 1e6, 1, 2),
      1414213562373000000,
      1e6
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(3 * 1e18, 2 * 1e6, 1, 2),
      2449489742783000000,
      1e6
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(2 * 1e18, 3 * 1e6, 1, 2),
      2449489742783000000,
      1e6
    );
  }

  function test_calculateScore_commutative(uint256 a, uint256 b) public {
    // Test that the score is commutative within some error bounds, ie that:
    // a^0.5 * b^0.5 ~= b^0.5 * a^0.5

    vm.assume(a < 1_000_000_000);
    vm.assume(b < 1_000_000_000);

    assertApproxEqAbs(
      MembershipScores.calculateScore(a * 1e18, b * 1e6, 1, 2),
      MembershipScores.calculateScore(b * 1e18, a * 1e6, 1, 2),
      1e16
    );

    assertApproxEqAbs(
      MembershipScores.calculateScore(a * 1e18, b, 1, 2),
      MembershipScores.calculateScore(b * 1e18, a, 1, 2),
      1e16
    );

    assertApproxEqAbs(
      MembershipScores.calculateScore(a, b * 1e6, 1, 2),
      MembershipScores.calculateScore(b, a * 1e6, 1, 2),
      1e16
    );

    assertApproxEqAbs(
      MembershipScores.calculateScore(a, b, 1, 2),
      MembershipScores.calculateScore(b, a, 1, 2),
      1e16
    );
  }

  function test_calculateScore_simple(uint256 x) public {
    // Test that if both sides are even, the outcome is equivalent to the equal inputs

    vm.assume(x < 1_000_000_000);

    assertEq(MembershipScores.calculateScore(x * 1e18, x * 1e6, 1, 2), x * 1e18);
  }

  function test_calculateScore_evenSplitOptimality(uint256 x) public {
    // Test that evenly splitting assets is the maximal allocation of resources

    vm.assume(x < 1_000_000_000);
    vm.assume(x > 10);

    uint256 evenSplit = MembershipScores.calculateScore((x * 1e18) / 2, (x * 1e6) / 2, 1, 2);

    uint256 iterations = 20;
    for (uint256 i = 1; i < iterations; i++) {
      if (i == iterations / 2) continue;

      assertTrue(
        evenSplit >
          MembershipScores.calculateScore(
            (x * 1e18 * i) / iterations,
            (x * 1e6 * (iterations - i)) / iterations,
            1,
            2
          )
      );

      assertTrue(
        evenSplit >
          MembershipScores.calculateScore(
            (x * 1e18 * (iterations - i)) / iterations,
            (x * 1e6 * i) / iterations,
            1,
            2
          )
      );
    }
  }

  function test_calculateScore_fractional() public {
    // Test that fractional values evaluate within expected bounds

    assertApproxEqAbs(
      MembershipScores.calculateScore(100 * 1e18, 1, 1, 2),
      10000000000000000,
      1e16
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(100 * 1e18, 1e6 / 2, 1, 2),
      7071067811870000000,
      1e16
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(100 * 1e18, 1e6 - 1, 1, 2),
      9999994999990000000,
      1e16
    );

    assertApproxEqAbs(MembershipScores.calculateScore(1, 100 * 1e6, 1, 2), 10000000000000000, 1e16);
    assertApproxEqAbs(
      MembershipScores.calculateScore(1e18 / 2, 100 * 1e6, 1, 2),
      7071067811870000000,
      1e16
    );
    assertApproxEqAbs(
      MembershipScores.calculateScore(1e18 - 1, 100 * 1e6, 1, 2),
      9999994999990000000,
      1e16
    );
  }

  function test_calculateScore_fuzzyMagnitude(uint256 gfi, uint256 capital) public {
    // Already checked these by hand
    vm.assume(gfi > 10 && capital > 10);

    // We're comparing approximations here, limit the size of the inputs to
    // a reasonable amount to limit drift
    vm.assume(gfi < 1e12);
    vm.assume(capital < 1e12);

    uint256 score = MembershipScores.calculateScore(gfi * 1e18, capital * 1e6, 1, 2);
    uint256 approximation = sqrt(gfi) * sqrt(capital) * 1e18; // sqrt(x) = x^0.5

    if (score < approximation) {
      assertTrue(approximation / score == 1);
    } else {
      assertTrue(score / approximation == 1);
    }
  }

  function test_calculateScore_fuzzyBounds(uint256 gfi, uint256 capital) public {
    // Avoid overflows
    vm.assume(gfi < 1e12);
    vm.assume(capital < 1e12);

    // Less than or equal because if gfi ~= capital then score = gfi = capital
    assertTrue(
      MembershipScores.calculateScore(gfi * 1e18, capital * 1e6, 1, 2) <=
        (gfi * 1e18 * capital * 1e6) / 2
    );
  }

  function test_calculateScore_all() public {
    // Test many different setups of cobb douglas. This tests from a fixture using 1e2 decimal places. Unfortunately,
    // json parsing in forge currently throws an error for too large of numbers. We get around this by using different
    // decimal places then adjusting in the code below.

    string memory root = vm.projectRoot();
    string memory path = string.concat(root, "/contracts/test/fixtures/cobb_douglas_base1e2.json");
    string memory data = vm.readFile(path);
    bytes memory parsedData = vm.parseJson(data);
    TestCase[] memory testCases = abi.decode(parsedData, (TestCase[]));

    for (uint256 i = 0; i < testCases.length; i++) {
      TestCase memory testCase = testCases[i];

      assertApproxEqAbs(
        MembershipScores.calculateScore({
          gfi: testCase.gfi * 1e16,
          capital: testCase.capital * 1e4,
          alphaNumerator: 1,
          alphaDenominator: 2
        }),
        testCase.expectedOutput * 1e16,
        1e18
      );
    }
  }

  function test_calculateScore_manyFractions() public {
    // Unlike the above function, when testing the decimal values of gfi and capital, we stay within the
    // required bounds and do not need to adjust.

    string memory root = vm.projectRoot();
    string memory path = string.concat(
      root,
      "/contracts/test/fixtures/cobb_douglas_actualBase.json"
    );
    string memory data = vm.readFile(path);
    bytes memory parsedData = vm.parseJson(data);
    TestCase[] memory testCases = abi.decode(parsedData, (TestCase[]));

    for (uint256 i = 0; i < testCases.length; i++) {
      TestCase memory testCase = testCases[i];

      assertApproxEqAbs(
        MembershipScores.calculateScore({
          gfi: testCase.gfi,
          capital: testCase.capital,
          alphaNumerator: 1,
          alphaDenominator: 2
        }),
        testCase.expectedOutput,
        1e18
      );
    }
  }

  // https://github.com/Uniswap/v2-core/blob/v1.0.1/contracts/libraries/Math.sol
  // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
  function sqrt(uint256 y) private pure returns (uint256 z) {
    if (y > 3) {
      z = y;
      uint256 x = y / 2 + 1;
      while (x < z) {
        z = x;
        x = (y / x + x) / 2;
      }
    } else if (y != 0) {
      z = 1;
    }
  }
}
