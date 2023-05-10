// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";

contract TranchedPoolInitializationTest is TranchedPoolBaseTest {
  function testInitializationSetsCorrectTrancheDefaults() public {
    (TranchedPool pool, ) = defaultTranchedPool();

    ITranchedPool.TrancheInfo memory junior = pool.getTranche(2);
    assertEq(junior.principalSharePrice, UNIT_SHARE_PRICE);
    assertZero(junior.interestSharePrice);
    assertZero(junior.principalDeposited);
    assertZero(junior.lockedUntil);

    ITranchedPool.TrancheInfo memory senior = pool.getTranche(1);
    assertEq(senior.principalSharePrice, UNIT_SHARE_PRICE);
    assertZero(senior.interestSharePrice);
    assertZero(senior.principalDeposited);
    assertZero(senior.lockedUntil);
  }

  function testInitializationGrantsProperRoles() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    assertTrue(pool.hasRole(pool.SENIOR_ROLE(), address(this)));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), GF_OWNER));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), BORROWER));
  }

  function testInitializationCantHappenTwice() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    uint256[] memory uidTypes = new uint256[](1);
    ISchedule s = defaultSchedule();
    vm.expectRevert("Initializable: contract is already initialized");
    pool.initialize(address(gfConfig), BORROWER, 0, 0, 0, s, 0, block.timestamp, uidTypes);
  }

  function testCreditLineCannotBeReinitialized() public {
    (, CreditLine cl) = defaultTranchedPool();

    ISchedule s = defaultSchedule();
    vm.expectRevert("Initializable: contract is already initialized");
    cl.initialize(address(gfConfig), GF_OWNER, BORROWER, 0, 0, s, 0);
  }

  function testGetAmountsOwedFailedForUninitializedCreditLine() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert(bytes("LI"));
    pool.getAmountsOwed(block.timestamp);
  }

  function testJuniorFeePercentCannotExceed100(uint256 juniorFeePercent) public {
    vm.assume(juniorFeePercent > 100);
    TranchedPool pool = new TranchedPool();
    uint256[] memory uidTypes = new uint256[](1);
    ISchedule s = defaultSchedule();
    vm.expectRevert(bytes("JF"));
    pool.initialize({
      _config: address(gfConfig),
      _borrower: address(this),
      _juniorFeePercent: juniorFeePercent,
      _limit: 1,
      _interestApr: 1,
      _schedule: s,
      _lateFeeApr: 1,
      _fundableAt: 0,
      _allowedUIDTypes: uidTypes
    });
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      createMonthlySchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function createMonthlySchedule(
    uint periodsInTerm,
    uint periodsPerPrincipalPeriod,
    uint periodsPerInterestPeriod,
    uint gracePrincipalPeriods
  ) public returns (ISchedule) {
    return
      new Schedule({
        _periodMapper: new MonthlyPeriodMapper(),
        _periodsInTerm: periodsInTerm,
        _periodsPerInterestPeriod: periodsPerInterestPeriod,
        _periodsPerPrincipalPeriod: periodsPerPrincipalPeriod,
        _gracePrincipalPeriods: gracePrincipalPeriods
      });
  }
}
