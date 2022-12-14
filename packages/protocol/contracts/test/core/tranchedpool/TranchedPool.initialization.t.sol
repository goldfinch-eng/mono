// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

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
    assertTrue(pool.hasRole(pool.SENIOR_ROLE(), address(seniorPool)));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), GF_OWNER));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), BORROWER));
  }

  function testInitializationCantHappenTwice() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    uint256[] memory uidTypes = new uint256[](1);
    vm.expectRevert("Contract instance has already been initialized");
    // TODO(will)
    // pool.initialize(address(gfConfig), BORROWER, 0, 0, 0, 0, 0, 0, 0, block.timestamp, uidTypes);
  }

  function testCreditLineCannotBeReinitialized() public {
    (, CreditLine cl) = defaultTranchedPool();

    // Initializer without "other" cl
    vm.expectRevert("Contract instance has already been initialized");
    // TODO(will)
    // cl.initialize(address(gfConfig), GF_OWNER, BORROWER, 0, 0, 0, 0, 0, 0);

    // Initializer with "other" cl
    vm.expectRevert("Contract instance has already been initialized");
    // TODO(will)
    // cl.initialize(
    //   address(gfConfig),
    //   GF_OWNER,
    //   BORROWER,
    //   0,
    //   0,
    //   0,
    //   0,
    //   0,
    //   0,
    //   ICreditLine(address(cl))
    // );
  }

  function testGetAmountsOwedFailedForUninitializedCreditLine() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert(bytes("LI"));
    pool.getAmountsOwed(block.timestamp);
  }
}
