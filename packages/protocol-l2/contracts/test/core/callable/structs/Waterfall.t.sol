// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
// solhint-disable-next-line max-line-length
import {Tranche} from "../../../../protocol/core/callable/structs/Tranche.sol";
import {Waterfall} from "../../../../protocol/core/callable/structs/Waterfall.sol";

contract TestWaterfall is Test {
  Waterfall internal w;

  function setUp() external {
    w.initialize(4);
  }

  function testDepositAddsPrincipalToUncalledTranche(uint256 amount) external {
    Tranche storage trancheBefore = w.getTranche(w.numTranches() - 1);
    assertTrue(trancheBefore.principalDeposited() == 0);
    assertTrue(trancheBefore.principalPaid() == 0);
    assertTrue(trancheBefore.interestPaid() == 0);

    w.deposit(amount);

    for (uint256 i = 0; i < w.numTranches(); i++) {
      Tranche storage sampled = w.getTranche(i);
      // if its the tranche that we deposited into
      bool isUncalledTranche = i == w.numTranches() - 1;
      assertEq(sampled.principalDeposited(), isUncalledTranche ? amount : 0);
      assertEq(sampled.interestPaid(), 0);
      assertEq(sampled.principalPaid(), isUncalledTranche ? amount : 0);
    }
  }

  /*
  depositing and withdrawal
    - depositing adds to principal in the specified tranche. No other tranches
      are modified
    - depositing when theres been interest paid should revert
  
  moving principal behavior
    - cant move more principal than exists in a tranche
    - moving principal moves proportional amount of interest

  paying
    - updates principal outstanding correctly
    - distributes interest payment proportionally to principal outstanding
    - pays tranche principal in order
    - updates totalPrincipalOutstanding with principalPaid

  cumulativeRedeemableAmount
  */
}
