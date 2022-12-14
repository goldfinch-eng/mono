// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {IV3CreditLine} from "../../../interfaces/IV3CreditLine.sol";
import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

contract TranchedPoolV2InitializationTest is TranchedPoolV2BaseTest {
  function testInitializationSetsCorrectTrancheDefaults() public {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();

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
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    assertTrue(pool.hasRole(pool.SENIOR_ROLE(), address(seniorPool)));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), GF_OWNER));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), BORROWER));
  }

  function testInitializationCantHappenTwice() public {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    uint256[] memory uidTypes = new uint256[](1);
    vm.expectRevert("Contract instance has already been initialized");
    pool.initialize(address(gfConfig), BORROWER, 0, 0, 0, 0, 0, 0, 0, block.timestamp, uidTypes);
  }

  function testCreditLineCannotBeReinitialized() public {
    (, CreditLineV2 cl) = defaultTranchedPool();

    // Initializer without "other" cl
    vm.expectRevert("Contract instance has already been initialized");
    cl.initialize(address(gfConfig), GF_OWNER, BORROWER, 0, 0, 0, 0, 0, 0);

    // Initializer with "other" cl
    vm.expectRevert("Contract instance has already been initialized");
    cl.initialize(
      address(gfConfig),
      GF_OWNER,
      BORROWER,
      0,
      0,
      0,
      0,
      0,
      0,
      IV3CreditLine(address(cl))
    );
  }

  function testGetAmountsOwedFailedForUninitializedCreditLine() public {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.expectRevert(bytes("LI"));
    pool.getAmountsOwed(block.timestamp);
  }
}
