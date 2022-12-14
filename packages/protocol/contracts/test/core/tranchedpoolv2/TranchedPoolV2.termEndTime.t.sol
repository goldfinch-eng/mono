// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2TermEndTimeTest is TranchedPoolV2BaseTest {
  function testTermEndTimeIsSetOnFirstDrawdown(uint256 amount) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    setMaxLimit(pool, amount * 5);

    assertZero(cl.termEndTime());
    fundAndDrawdown(pool, amount, GF_OWNER);
    assertEq(cl.termEndTime(), block.timestamp + termInSeconds(cl));
  }

  // TODO - bug when you drawdown multiple times!
  function testTermEndTimeDoesNotChangeOnSubsequentDrawdown(uint256 amount) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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

  function termInSeconds(CreditLineV2 cl) internal returns (uint256) {
    return cl.termInDays() * (1 days);
  }
}
