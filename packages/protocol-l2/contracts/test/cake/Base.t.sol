// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {CakeHelper} from "./helpers/CakeHelper.t.sol";

import {Base} from "../../cake/Base.sol";
import {Context} from "../../cake/Context.sol";
import {IAccessControl} from "../../interfaces/IAccessControl.sol";

bytes4 constant TestOperator = bytes4(keccak256(abi.encode("testOperator")));
bytes4 constant TestOperator2 = bytes4(keccak256(abi.encode("testOperator2")));

contract TestContract is Base {
  // solhint-disable-next-line no-empty-blocks
  constructor(Context _context) Base(_context) {}

  // solhint-disable-next-line no-empty-blocks
  function operatorFunction() public onlyOperator(TestOperator) {}

  // solhint-disable-next-line no-empty-blocks
  function operatorsFunction() public onlyOperators([TestOperator, TestOperator2]) {}

  // solhint-disable-next-line no-empty-blocks
  function adminFunction() public onlyAdmin {}
}

contract BaseTest is Test {
  CakeHelper private cake;
  TestContract private testContract;

  address private operator = address(1);
  address private operator2 = address(2);
  address private admin = address(3);
  address private someOtherAddress = address(4);

  function setUp() public {
    cake = new CakeHelper(address(this));
    testContract = new TestContract(cake.context());
  }

  function testOnlyOperatorRevertsForNonOperator() public {
    cake.router().setContract(TestOperator, address(operator));

    vm.startPrank(someOtherAddress);
    vm.expectRevert(
      abi.encodeWithSelector(
        Base.RequiresOperator.selector,
        address(testContract),
        someOtherAddress
      )
    );
    testContract.operatorFunction();
  }

  function testOnlyOperatorRevertsForZeroAddress() public {
    cake.router().setContract(TestOperator, address(operator));

    vm.startPrank(address(0));
    vm.expectRevert(abi.encodeWithSelector(Base.ZeroAddress.selector));
    testContract.operatorFunction();
  }

  function testOnlyOperatorSucceedsForOperator() public {
    cake.router().setContract(TestOperator, address(operator));

    vm.startPrank(operator);
    testContract.operatorFunction();
  }

  function testOnlyOperatorsRevertsForNonOperator() public {
    cake.router().setContract(TestOperator, address(operator));
    cake.router().setContract(TestOperator2, address(operator2));

    vm.startPrank(someOtherAddress);
    vm.expectRevert(
      abi.encodeWithSelector(
        Base.RequiresOperator.selector,
        address(testContract),
        someOtherAddress
      )
    );
    testContract.operatorsFunction();
  }

  function testOnlyOperatorsRevertsForZeroAddress() public {
    cake.router().setContract(TestOperator, address(operator));
    cake.router().setContract(TestOperator2, address(operator2));

    vm.startPrank(address(0));
    vm.expectRevert(abi.encodeWithSelector(Base.ZeroAddress.selector));
    testContract.operatorsFunction();
  }

  function testOnlyOperatorsSucceedsForAnyOperatorInArray() public {
    cake.router().setContract(TestOperator, address(operator));
    cake.router().setContract(TestOperator2, address(operator2));

    vm.startPrank(operator);
    testContract.operatorsFunction();
    vm.stopPrank();

    vm.startPrank(operator2);
    testContract.operatorsFunction();
  }

  function testOnlyAdminRevertsForNonAdmin() public {
    cake.accessControl().setAdmin(address(testContract), admin);
    vm.startPrank(someOtherAddress);
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.RequiresAdmin.selector,
        address(testContract),
        someOtherAddress
      )
    );
    testContract.adminFunction();
  }

  function testOnlyAdminSucceedsForAdmin() public {
    cake.accessControl().setAdmin(address(testContract), admin);
    vm.startPrank(admin);
    testContract.adminFunction();
  }
}
