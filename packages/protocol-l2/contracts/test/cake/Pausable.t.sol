// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {CakeHelper} from "./helpers/CakeHelper.t.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {Base} from "../../cake/Base.sol";
import "../../cake/Routing.sol" as Routing;
import {PausableUpgradeable} from "../../cake/Pausable.sol";
import {Context} from "../../cake/Context.sol";

bytes4 constant TestOperator = bytes4(keccak256(abi.encode("testOperator")));
bytes4 constant TestOperator2 = bytes4(keccak256(abi.encode("testOperator2")));

contract TestContract is Base, Initializable, PausableUpgradeable {
  // solhint-disable-next-line no-empty-blocks
  constructor(Context _context) Base(_context) {}

  function initialize() external initializer {
    __Pausable_init_unchained();
  }

  // solhint-disable-next-line no-empty-blocks
  function operatorFunction() public onlyOperator(TestOperator) {}

  // solhint-disable-next-line no-empty-blocks
  function operatorsFunction() public onlyOperators([TestOperator, TestOperator2]) {}

  // solhint-disable-next-line no-empty-blocks
  function adminFunction() public onlyAdmin {}
}

contract PausableTest is Test {
  CakeHelper private cake;
  TestContract private testContract;

  address private pauser = address(1);
  address private governance = address(2);
  address private someOtherAddress = address(3);

  function setUp() public {
    cake = new CakeHelper(address(this));
    testContract = new TestContract(cake.context());
    testContract.initialize();

    cake.router().setContract(Routing.Keys.PauserAdmin, pauser);
    cake.router().setContract(Routing.Keys.ProtocolAdmin, governance);
  }

  function test_pause_revertsForNonOperator() public {
    vm.startPrank(someOtherAddress);
    vm.expectRevert(
      abi.encodeWithSelector(
        Base.RequiresOperator.selector,
        address(testContract),
        someOtherAddress
      )
    );
    testContract.pause();
  }

  function test_pause_pauses() public {
    vm.startPrank(pauser);
    testContract.pause();
    assertTrue(testContract.paused());

    testContract.unpause();
    assertFalse(testContract.paused());
    vm.stopPrank();

    vm.startPrank(governance);
    testContract.pause();
    assertTrue(testContract.paused());
  }

  function test_unpause_revertsForNonOperator() public {
    vm.startPrank(someOtherAddress);
    vm.expectRevert(
      abi.encodeWithSelector(
        Base.RequiresOperator.selector,
        address(testContract),
        someOtherAddress
      )
    );
    testContract.unpause();
  }

  function test_unpause_unpauses() public {
    vm.startPrank(pauser);
    testContract.pause();
    assertTrue(testContract.paused());
    testContract.unpause();
    assertFalse(testContract.paused());
    vm.stopPrank();

    vm.startPrank(governance);
    testContract.pause();
    assertTrue(testContract.paused());
    testContract.unpause();
    assertFalse(testContract.paused());
  }
}
