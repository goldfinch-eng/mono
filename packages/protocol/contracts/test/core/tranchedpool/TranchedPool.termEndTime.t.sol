// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolTermEndTimeTest is TranchedPoolBaseTest {
  function testTermEndTimeIsSetOnFirstDrawdown(uint256 amount) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    setMaxLimit(pool, amount * 5);

    assertZero(cl.termEndTime());
    fundAndDrawdown(pool, amount, GF_OWNER);
    // This is >= because of the creation of the stub period
    assertGe(cl.termEndTime(), block.timestamp + termInSeconds(cl));
  }

  function testTermEndTimeDoesNotChangeOnSubsequentDrawdown(uint256 amount) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    amount = bound(amount, usdcVal(2), usdcVal(10_000_000));
    setMaxLimit(pool, amount * 5);

    deposit(pool, 2, amount, GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, amount * 4);
    lockSeniorTranche(pool);

    drawdown(pool, amount);
    uint256 termEndTimeBefore = cl.termEndTime();
    drawdown(pool, amount);
    assertEq(cl.termEndTime(), termEndTimeBefore);
  }

  function termInSeconds(CreditLine cl) internal view returns (uint256) {
    return cl.termEndTime() - cl.termStartTime();
  }
}
