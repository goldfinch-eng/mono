// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseTest} from "./BaseTest.t.sol";
import {Pauser} from "../../protocol/core/Pauser.sol";

contract TestPauser is Pauser {
  function initialize(address owner) external initializer {
    __Pauser_init();
    _setupRole(PAUSER_ROLE, owner);
  }
}

contract PauserTest is BaseTest {
  TestPauser pauser;

  function setUp() public override {
    super.setUp();

    pauser = new TestPauser();
    pauser.initialize(address(this));
  }

  function testPausePausesIndividualContract(address someAddress) public {
    assertFalse(pauser.isPaused(someAddress));

    pauser.pause(someAddress);

    assertTrue(pauser.isPaused(someAddress));
  }

  function testPauseEmitsPausedEvent(address someAddress) public {
    vm.expectEmit(true, true, true, true);
    emit Paused(someAddress);

    pauser.pause(someAddress);
  }

  function testUnpauseUnpausesIndividualContract(address someAddress) public {
    pauser.pause(someAddress);
    assertTrue(pauser.isPaused(someAddress));

    pauser.unpause(someAddress);
    assertFalse(pauser.isPaused(someAddress));
  }

  function testUnpauseEmitsUnpausedEvent(address someAddress) public {
    vm.expectEmit(true, true, true, true);
    emit Unpaused(someAddress);

    pauser.unpause(someAddress);
  }

  function testGlobalPausePausesAllContracts(address addr1, address addr2) public {
    pauser.globalPause();
    assertTrue(pauser.isPaused(addr1));
    assertTrue(pauser.isPaused(addr2));
  }

  function testGlobalPauseEmitsGlobalPausedEvent() public {
    vm.expectEmit(true, true, true, true);
    emit GlobalPaused();

    pauser.globalPause();
  }

  function testGlobalPauseTakesPrecedentOverIndividualPause(address addr1) public {
    pauser.unpause(addr1);
    assertFalse(pauser.isPaused(addr1));

    pauser.globalPause();
    assertTrue(pauser.isPaused(addr1));
  }

  function testGlobalUnpauseUnpausesAllContracts(address addr1, address addr2) public {
    pauser.globalPause();
    assertTrue(pauser.isPaused(addr1));
    assertTrue(pauser.isPaused(addr2));

    pauser.globalUnpause();
    assertFalse(pauser.isPaused(addr1));
    assertFalse(pauser.isPaused(addr2));
  }

  function testGlobalUnpauseEmitsGlobalUnpausedEvent() public {
    vm.expectEmit(true, true, true, true);
    emit GlobalUnpaused();

    pauser.globalUnpause();
  }

  function testIndividualPauseTakesPrecedentOverGlobalUnpause(address addr1) public {
    pauser.globalPause();
    pauser.pause(addr1);
    pauser.globalUnpause();

    assertTrue(pauser.isPaused(addr1));
  }

  function testPauseOnlyCallableByPauserRole(address someOtherCaller) public {
    vm.assume(!pauser.hasRole(pauser.PAUSER_ROLE(), someOtherCaller));

    _startImpersonation(someOtherCaller);
    vm.expectRevert(bytes("NA"));
    pauser.pause(address(1));
  }

  function testUnpauseOnlyCallableByPauserRole(address someOtherCaller) public {
    vm.assume(!pauser.hasRole(pauser.PAUSER_ROLE(), someOtherCaller));

    _startImpersonation(someOtherCaller);
    vm.expectRevert(bytes("NA"));
    pauser.unpause(address(1));
  }

  function testGlobalPauseOnlyCallableByPauserRole(address someOtherCaller) public {
    vm.assume(!pauser.hasRole(pauser.PAUSER_ROLE(), someOtherCaller));

    _startImpersonation(someOtherCaller);
    vm.expectRevert(bytes("NA"));
    pauser.globalPause();
  }

  function testGlobalUnpauseOnlyCallableByPauserRole(address someOtherCaller) public {
    vm.assume(!pauser.hasRole(pauser.PAUSER_ROLE(), someOtherCaller));

    _startImpersonation(someOtherCaller);
    vm.expectRevert(bytes("NA"));
    pauser.globalUnpause();
  }

  event Paused(address account);
  event Unpaused(address account);
  event GlobalPaused();
  event GlobalUnpaused();
}
