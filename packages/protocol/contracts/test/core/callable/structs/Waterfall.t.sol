// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;
pragma experimental ABIEncoderV2;


// TODO: import test file

import "forge-std/Test.sol";
import {Waterfall, WaterfallLogic} from "../../../../protocol/core/callable/structs/Waterfall.sol";

using WaterfallLogic for Waterfall;

contract TestWaterfall is Test {
  
  Waterfall internal w;
  
  
  
  function setUp() external {
    w.initialize(4);
  }

  function testDepositAddsPrincipalToTranche(
    uint amount
  ) external {
    uint trancheId;
    trancheId = bound(trancheId, 0, w.numTranches());

    Tranche storage trancheBefore = w.getTranche(trancheId);
    assertTrue(trancheBefore.principalDeposited() == 0);
    assertTrue(trancheBefore.principalPaid() == 0);
    assertTrue(trancheBefore.interestPaid() == 0);

    w.deposit(trancheId, amount);
  
    Tranche storage trancheAfter = w.getTranche(trancheId);
    assertTrue(trancheBefore.principalDeposited() == amount);
    assertTrue(trancheBefore.interestPaid() == 0);
    assertTrue(trancheBefore.principalPaid() == 0);
  

    // for each tranche thats not tranche, assert nothing changed
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