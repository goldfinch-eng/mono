// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseTest} from "./BaseTest.t.sol";
import {IPauser, Pauser} from "../../protocol/core/Pauser.sol";
import {Pausable} from "../../protocol/core/Pausable.sol";

contract TestPauser is Pauser {
  function initialize(address owner) external initializer {
    __Pauser_init();
    _setupRole(PAUSER_ROLE, owner);
  }
}

contract TestPausable is Pausable {
  function initialize(IPauser pauser) external initializer {
    __Pausable_init(pauser);
  }

  function foo() external whenNotPaused {}
}

contract PausableTest is BaseTest {
  TestPauser pauser;
  TestPausable pausable;

  function setUp() public override {
    super.setUp();

    pauser = new TestPauser();
    pauser.initialize(address(this));

    pausable = new TestPausable();
    pausable.initialize(pauser);
  }

  function testRevertsIfPauserIsZeroAddress() public {
    pausable = new TestPausable();
    vm.expectRevert(bytes("ZA"));
    pausable.initialize(IPauser(address(0)));
  }

  function testWhenNotPausedRevertsWhenPaused() public {
    pauser.pause(address(pausable));

    vm.expectRevert(bytes("Pausable: paused"));
    pausable.foo();
  }

  function testWhenNotPausedRevertsWhenGlobalPaused() public {
    pauser.globalPause();

    vm.expectRevert(bytes("Pausable: paused"));
    pausable.foo();
  }

  function testPausedIsTrueWhenPaused() public {
    pauser.pause(address(pausable));

    assertTrue(pausable.paused());
  }

  function testPausedIsFalseWhenNotPaused() public view {
    assertFalse(pausable.paused());
  }

  function testPausedIsFalseWhenUnpaused() public {
    pauser.pause(address(pausable));
    pauser.unpause(address(pausable));

    assertFalse(pausable.paused());
  }

  function testPausedIsTrueWhenGlobalPaused() public {
    pauser.globalPause();

    assertTrue(pausable.paused());
  }

  function testPausedIsFalseWhenGlobalUnpaused() public {
    pauser.globalPause();
    pauser.globalUnpause();

    assertFalse(pausable.paused());
  }
}
