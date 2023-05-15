// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "../BaseTest.t.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {GoldfinchFactory} from "../../../protocol/core/GoldfinchFactory.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";
import {TranchedPoolImplementationRepository} from "../../../protocol/core/TranchedPoolImplementationRepository.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";

contract GoldfinchFactoryTest is BaseTest {
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;

  function setUp() public override {
    super.setUp();

    _startImpersonation(GF_OWNER);

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));

    TranchedPool poolImpl = new TranchedPool();
    TranchedPoolImplementationRepository poolImplRepo = new TranchedPoolImplementationRepository();
    poolImplRepo.initialize(GF_OWNER, address(poolImpl));

    PoolTokens poolTokens = new PoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);

    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(poolImplRepo)
    );
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));

    fuzzHelper.exclude(address(gfConfig));
    fuzzHelper.exclude(address(gfFactory));
    fuzzHelper.exclude(address(poolImpl));
    fuzzHelper.exclude(address(poolImplRepo));
    fuzzHelper.exclude(address(poolTokens));

    _stopImpersonation();
  }

  function testAdminCanCreatePool() public impersonating(GF_OWNER) {
    uint256[] memory allowedIdTypes = new uint256[](1);
    vm.expectEmit(true, true, false, false);
    address expectedPoolAddress = computeCreateAddress(
      address(gfFactory),
      vm.getNonce(address(gfFactory))
    );
    emit PoolCreated(ITranchedPool(expectedPoolAddress), address(this));
    ITranchedPool pool = gfFactory.createPool(
      address(this),
      1,
      2,
      3,
      defaultSchedule(),
      7,
      block.timestamp,
      allowedIdTypes
    );
    assertEq(address(pool), expectedPoolAddress);
  }

  function testBorrowerCanCreatePool() public {
    assertFalse(gfFactory.hasRole(TestConstants.BORROWER_ROLE, address(this)));

    grantRole(address(gfFactory), TestConstants.BORROWER_ROLE, address(this));

    uint256[] memory allowedIdTypes = new uint256[](1);
    address expectedPoolAddress = computeCreateAddress(
      address(gfFactory),
      vm.getNonce(address(gfFactory))
    );
    vm.expectEmit(true, true, false, false);
    emit PoolCreated(ITranchedPool(expectedPoolAddress), address(this));
    ITranchedPool pool = gfFactory.createPool(
      address(this),
      1,
      2,
      3,
      defaultSchedule(),
      7,
      block.timestamp,
      allowedIdTypes
    );
    assertEq(address(pool), expectedPoolAddress);
  }

  function testNonAdminNonBorrowerCantCreatePool(
    address notAdminOrBorrower
  ) public impersonating(notAdminOrBorrower) {
    vm.assume(!gfFactory.hasRole(TestConstants.OWNER_ROLE, notAdminOrBorrower));
    vm.assume(!gfFactory.hasRole(TestConstants.BORROWER_ROLE, notAdminOrBorrower));

    uint256[] memory allowedIdTypes = new uint256[](1);
    ISchedule schedule = defaultSchedule();
    vm.expectRevert("Must have admin or borrower role to perform this action");
    ITranchedPool pool = gfFactory.createPool(
      address(this),
      1,
      2,
      3,
      schedule,
      7,
      block.timestamp,
      allowedIdTypes
    );
  }

  function testOwnerCanGrantBorrowerRole(address newBorrower) public impersonating(GF_OWNER) {
    vm.assume(!gfFactory.hasRole(TestConstants.BORROWER_ROLE, newBorrower));
    gfFactory.grantRole(TestConstants.BORROWER_ROLE, newBorrower);
    assertTrue(gfFactory.hasRole(TestConstants.BORROWER_ROLE, newBorrower));
  }

  function testNonOwnerCantGrantBorrowerRole(
    address notOwner,
    address newBorrower
  ) public impersonating(notOwner) {
    vm.assume(!gfFactory.hasRole(TestConstants.OWNER_ROLE, notOwner));
    vm.expectRevert("AccessControl: sender must be an admin to grant");
    gfFactory.grantRole(TestConstants.BORROWER_ROLE, newBorrower);
  }

  function testBorrowerCantGrantBorrowerRole(address borrower, address newBorrower) public {
    vm.assume(!gfFactory.hasRole(TestConstants.BORROWER_ROLE, newBorrower));
    vm.assume(!gfFactory.hasRole(TestConstants.OWNER_ROLE, borrower));

    grantRole(address(gfFactory), TestConstants.BORROWER_ROLE, address(this));

    _startImpersonation(borrower);
    vm.expectRevert("AccessControl: sender must be an admin to grant");
    gfFactory.grantRole(TestConstants.BORROWER_ROLE, newBorrower);
  }

  function testOnlyBorrowerOrAdminCanCallCreateCallableLoanWithProxyOwner(
    address notBorrower,
    uint256[] calldata _allowedUIDTypes
  ) public {
    assertFalse(gfFactory.hasRole(TestConstants.BORROWER_ROLE, notBorrower));
    assertFalse(gfFactory.hasRole(TestConstants.OWNER_ROLE, notBorrower));

    ISchedule schedule = defaultSchedule();

    vm.expectRevert("Must have admin or borrower role to perform this action");
    gfFactory.createCallableLoanWithProxyOwner({
      _proxyOwner: address(0xDEADBEEF),
      _borrower: notBorrower,
      _limit: 100_000e6,
      _interestApr: 0.18e18,
      _numLockupPeriods: 2,
      _schedule: schedule,
      _lateFeeApr: 0,
      _fundableAt: 0,
      _allowedUIDTypes: _allowedUIDTypes
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

  event PoolCreated(ITranchedPool indexed pool, address indexed borrower);
}
