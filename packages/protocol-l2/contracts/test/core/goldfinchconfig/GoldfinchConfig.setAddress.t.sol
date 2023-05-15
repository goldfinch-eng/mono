// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {GoldfinchConfigBaseTest} from "./BaseGoldfinchConfig.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoldfinchConfigSetAddressTest is GoldfinchConfigBaseTest {
  function testSetAddressRevertsForNonOwner(
    address notGfOwner,
    uint256 index,
    address newAddress
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    vm.expectRevert("Must have admin role to perform this action");
    gfConfig.setAddress(index, newAddress);
  }

  function testSetAddressShouldSetTheAddress(
    uint256 index,
    address newAddress
  ) public impersonating(GF_OWNER) {
    assertEq(gfConfig.getAddress(index), address(0));
    gfConfig.setAddress(index, newAddress);
    assertEq(gfConfig.getAddress(index), newAddress);
  }

  function testSetAddressRevertsForSecondSet(
    uint256 index,
    address newAddress1,
    address newAddress2
  ) public impersonating(GF_OWNER) {
    vm.assume(newAddress1 != newAddress2);
    vm.assume(newAddress1 != address(0) && newAddress2 != address(0));

    assertEq(gfConfig.getAddress(index), address(0));
    gfConfig.setAddress(index, newAddress1);
    assertEq(gfConfig.getAddress(index), newAddress1);

    vm.expectRevert("Address has already been initialized");
    gfConfig.setAddress(index, newAddress2);

    assertEq(gfConfig.getAddress(index), newAddress1);
  }

  function testSetAddressShouldEmitAnEvent(
    uint256 index,
    address newAddress
  ) public impersonating(GF_OWNER) {
    assertEq(gfConfig.getAddress(index), address(0));
    vm.expectEmit(false, false, false, true);
    emit AddressUpdated(GF_OWNER, index, address(0), newAddress);
    gfConfig.setAddress(index, newAddress);
  }

  function testSetMonthlyScheduleRepoRevertsForNonAdmin(
    address notAdmin,
    address newMonthlyScheduleRepo
  ) public {
    vm.assume(!gfConfig.hasRole(TestConstants.OWNER_ROLE, notAdmin));
    _startImpersonation(notAdmin);
    vm.expectRevert("Must have admin role to perform this action");
    gfConfig.setMonthlyScheduleRepo(newMonthlyScheduleRepo);
  }

  function testMonthlyScheduleRepoCanBeSetMultipleTimes(
    address monthlyScheduleRepo1,
    address monthlyScheduleRepo2
  ) public impersonating(GF_OWNER) {
    vm.assume(monthlyScheduleRepo1 != address(0) && monthlyScheduleRepo2 != address(0));
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo)), address(0));

    gfConfig.setMonthlyScheduleRepo(monthlyScheduleRepo1);
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo)),
      monthlyScheduleRepo1
    );

    gfConfig.setMonthlyScheduleRepo(monthlyScheduleRepo2);
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo)),
      monthlyScheduleRepo2
    );
  }

  function testSetMonthlyScheduleRepoEmitsAnEvent(
    address monthlyScheduleRepo
  ) public impersonating(GF_OWNER) {
    vm.assume(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo)) !=
        monthlyScheduleRepo
    );
    vm.expectEmit(false, false, false, true);
    emit AddressUpdated(
      GF_OWNER,
      uint256(ConfigOptions.Addresses.MonthlyScheduleRepo),
      address(0),
      monthlyScheduleRepo
    );
    gfConfig.setMonthlyScheduleRepo(monthlyScheduleRepo);
  }

  function testSetTreasuryReserveRevertsForNonAdmin(
    address notAdmin,
    address newTreasuryReserve
  ) public {
    vm.assume(!gfConfig.hasRole(TestConstants.OWNER_ROLE, notAdmin));
    _startImpersonation(notAdmin);
    vm.expectRevert("Must have admin role to perform this action");
    gfConfig.setTreasuryReserve(newTreasuryReserve);
  }

  function testTreasuryReserveCanBeSetMultipleTimes(
    address reserve1,
    address reserve2
  ) public impersonating(GF_OWNER) {
    vm.assume(reserve1 != address(0) && reserve2 != address(0));
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve)), address(0));

    gfConfig.setTreasuryReserve(reserve1);
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve)), reserve1);

    gfConfig.setTreasuryReserve(reserve2);
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve)), reserve2);
  }

  function testSetTreasuryReserveEmitsAnEvent(address reserve) public impersonating(GF_OWNER) {
    vm.assume(gfConfig.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve)) != reserve);
    vm.expectEmit(false, false, false, true);
    emit AddressUpdated(
      GF_OWNER,
      uint256(ConfigOptions.Addresses.TreasuryReserve),
      address(0),
      reserve
    );
    gfConfig.setTreasuryReserve(reserve);
  }

  function testSetSeniorPoolStratRevertsForNonAdmin(address notAdmin, address strat) public {
    vm.assume(!gfConfig.hasRole(TestConstants.OWNER_ROLE, notAdmin));
    _startImpersonation(notAdmin);
    vm.expectRevert("Must have admin role to perform this action");
    gfConfig.setSeniorPoolStrategy(strat);
  }

  function testSeniorPoolStratCanBeSetMultipleTimes(
    address strat1,
    address strat2
  ) public impersonating(GF_OWNER) {
    vm.assume(strat1 != address(0) && strat2 != address(0));
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy)), address(0));

    gfConfig.setSeniorPoolStrategy(strat1);
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy)), strat1);

    gfConfig.setSeniorPoolStrategy(strat2);
    assertEq(gfConfig.getAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy)), strat2);
  }

  function testSetSeniorPoolStratEmitsAnEvent(address strat) public impersonating(GF_OWNER) {
    vm.assume(gfConfig.getAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy)) != strat);
    vm.expectEmit(false, false, false, true);
    emit AddressUpdated(
      GF_OWNER,
      uint256(ConfigOptions.Addresses.SeniorPoolStrategy),
      address(0),
      strat
    );
    gfConfig.setSeniorPoolStrategy(strat);
  }

  event AddressUpdated(address owner, uint256 index, address oldValue, address newValue);
}
