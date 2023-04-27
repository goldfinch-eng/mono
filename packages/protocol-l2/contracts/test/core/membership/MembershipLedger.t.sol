// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../../../protocol/core/membership/MembershipLedger.sol";
import "../../../protocol/core/membership/Epochs.sol";
import {IAccessControl} from "../../../interfaces/IAccessControl.sol";

import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";

contract MockERC20 is ERC20Upgradeable {
  constructor(uint256 initialSupply) {
    _mint(msg.sender, initialSupply);
  }
}

contract MembershipLedgerTest is Test {
  CakeHelper private cake;

  MembershipLedger private ledger;

  MockERC20 private fidu = new MockERC20(type(uint128).max);

  address private membershipOrchestrator = address(12345);

  function setUp() public {
    cake = new CakeHelper(address(this));
    ledger = new MembershipLedger(cake.context());
    ledger.initialize();

    cake.router().setContract(Routing.Keys.MembershipDirector, address(this));

    cake.router().setContract(Routing.Keys.FIDU, address(fidu));
    cake.router().setContract(Routing.Keys.MembershipOrchestrator, membershipOrchestrator);

    vm.label(membershipOrchestrator, "Orchestrator");
    vm.label(address(this), "ContractTester");
  }

  function test_accessControl(address addr) public {
    vm.assume(addr != address(0));
    vm.assume(addr != address(this));

    vm.startPrank(addr);

    vm.expectRevert(abi.encodeWithSelector(Base.RequiresOperator.selector, address(ledger), addr));
    ledger.resetRewards(address(1));

    vm.expectRevert(abi.encodeWithSelector(Base.RequiresOperator.selector, address(ledger), addr));
    ledger.allocateRewardsTo(address(1), 1);

    vm.stopPrank();
  }

  function test_resetRewards(address addr, uint256 amount) public {
    ledger.allocateRewardsTo(addr, amount);
    assertEq(ledger.getPendingRewardsFor(addr), amount);

    ledger.resetRewards(addr);

    assertEq(ledger.getPendingRewardsFor(addr), 0);
  }

  function test_allocateRewardsTo(address addr, uint256 amount, uint256 amount2) public {
    vm.assume(amount < 1e12);
    vm.assume(amount2 < 1e12);

    ledger.allocateRewardsTo(addr, amount);
    assertEq(ledger.getPendingRewardsFor(addr), amount);

    ledger.allocateRewardsTo(addr, amount2);
    assertEq(ledger.getPendingRewardsFor(addr), amount + amount2);
  }

  function test_getPendingRewardsFor(address addr, uint256 amount) public {
    ledger.allocateRewardsTo(addr, amount);
    assertEq(ledger.getPendingRewardsFor(addr), amount);
  }

  function test_alpha() public {
    (uint256 n, uint256 d) = ledger.alpha();

    assertEq(n, 1);
    assertEq(d, 2);

    cake.accessControl().setAdmin(address(ledger), address(this));

    ledger.setAlpha(10, 20);
    (n, d) = ledger.alpha();

    assertEq(n, 10);
    assertEq(d, 20);

    ledger.setAlpha(19, 20);
    (n, d) = ledger.alpha();

    assertEq(n, 19);
    assertEq(d, 20);

    ledger.setAlpha(1, 20);
    (n, d) = ledger.alpha();

    assertEq(n, 1);
    assertEq(d, 20);

    ledger.setAlpha(1, 2);
    (n, d) = ledger.alpha();

    assertEq(n, 1);
    assertEq(d, 2);
  }

  function testFail_alpha_adminRequired() public {
    ledger.setAlpha(1, 2);
  }

  function test_alpha_numeratorTooLarge() public {
    cake.accessControl().setAdmin(address(ledger), address(this));

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaNumerator.selector));
    ledger.setAlpha(20, 2);

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaNumerator.selector));
    ledger.setAlpha(21, 2);

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaNumerator.selector));
    ledger.setAlpha(
      269984665640564039457584007913129639916,
      269984665640564039457584007913129639933
    );
  }

  function test_alpha_numeratorTooLow() public {
    cake.accessControl().setAdmin(address(ledger), address(this));

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaNumerator.selector));
    ledger.setAlpha(0, 2);
  }

  function test_alpha_denominatorTooLow() public {
    cake.accessControl().setAdmin(address(ledger), address(this));

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaDenominator.selector));
    ledger.setAlpha(1, 0);
  }

  function test_alpha_denominatorTooHigh() public {
    cake.accessControl().setAdmin(address(ledger), address(this));

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaDenominator.selector));
    ledger.setAlpha(1, 21);
  }

  function test_alpha_between0and1Exclusive() public {
    cake.accessControl().setAdmin(address(ledger), address(this));

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaGTE1.selector));
    ledger.setAlpha(3, 2);

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaGTE1.selector));
    ledger.setAlpha(2, 2);

    vm.expectRevert(abi.encodeWithSelector(MembershipLedger.InvalidAlphaGTE1.selector));
    ledger.setAlpha(1, 1);
  }
}
