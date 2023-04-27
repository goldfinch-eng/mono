// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "../../../protocol/core/membership/ERC20Splitter.sol";

import {ERC20} from "openzeppelin-contracts-0-8-x/token/ERC20/ERC20.sol";
import {Test, stdError} from "forge-std/Test.sol";

import "../../../cake/Routing.sol" as Routing;

import {IAccessControl} from "../../../interfaces/IAccessControl.sol";
import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";

contract TestERC20 is ERC20 {
  constructor(uint256 initialSupply) ERC20("TestERC20", "TERC20") {
    _mint(msg.sender, initialSupply);
  }
}

contract ValidRecipient is IERC20SplitterReceiver {
  event Received(uint256 amount);

  function onReceive(uint256 amount) external returns (bytes4) {
    emit Received(amount);
    return IERC20SplitterReceiver.onReceive.selector;
  }
}

contract RevertingRecipient is IERC20SplitterReceiver {
  error ReceiveError();

  function onReceive(uint256) external pure returns (bytes4) {
    revert ReceiveError();
  }
}

contract InvalidRecipient is IERC20SplitterReceiver {
  function onReceive(uint256) external pure returns (bytes4) {
    return bytes4(keccak256("incorrect"));
  }
}

contract ReenteringRecipient is IERC20SplitterReceiver {
  ERC20Splitter private splitter;

  constructor(ERC20Splitter _splitter) {
    splitter = _splitter;
  }

  function onReceive(uint256) external returns (bytes4) {
    splitter.distribute();
    return bytes4(keccak256("incorrect"));
  }
}

contract ERC20SplitterTest is Test {
  CakeHelper private cake;

  ERC20Splitter private splitter;

  TestERC20 private erc20;

  address private eoaSplitRecipient = address(1);
  address private contractSplitRecipient = address(2);
  address private pauser = address(3);
  ValidRecipient private validRecipient;

  address[] private payees;
  uint256[] private shares;

  function setUp() public {
    erc20 = new TestERC20(100_000e18);
    cake = new CakeHelper(address(this));

    validRecipient = new ValidRecipient();

    payees.push(eoaSplitRecipient);
    payees.push(contractSplitRecipient);
    payees.push(address(validRecipient));

    shares.push(20);
    shares.push(30);
    shares.push(50);

    splitter = new ERC20Splitter(cake.context(), erc20);

    cake.accessControl().setAdmin(address(splitter), address(this));
    splitter.replacePayees(payees, shares);
    cake.accessControl().setAdmin(address(splitter), address(0));

    cake.router().setContract(Routing.Keys.PauserAdmin, pauser);
  }

  function test_distribute_paysCorrectShareToRecipients() public {
    erc20.transfer(address(splitter), 100e18);
    splitter.distribute();

    assertEq(erc20.balanceOf(eoaSplitRecipient), 20e18);
    assertEq(erc20.balanceOf(contractSplitRecipient), 30e18);
    assertEq(erc20.balanceOf(address(validRecipient)), 50e18);
  }

  function test_distribute_setsLastDistributionAt() public {
    vm.warp(47);

    erc20.transfer(address(splitter), 100e18);
    splitter.distribute();

    assertEq(splitter.lastDistributionAt(), 47);
  }

  event Received(uint256 amount);

  function test_distribute_triggersOnReceiveForImplementors() public {
    erc20.transfer(address(splitter), 100e18);

    vm.expectEmit(true, true, false, false);
    emit Received(50e18);

    splitter.distribute();
  }

  function test_distribute_revertsOnIntraBlockDistribute() public {
    ReenteringRecipient reenteringRecipient = new ReenteringRecipient(splitter);
    cake.accessControl().setAdmin(address(splitter), address(this));

    payees.push(address(reenteringRecipient));
    shares.push(50);
    splitter.replacePayees(payees, shares);

    erc20.transfer(address(splitter), 100e18);
    vm.expectRevert(abi.encodeWithSelector(ERC20Splitter.IntraBlockDistribution.selector));
    splitter.distribute();
  }

  function test_distribute_revertsOnRevertingReceiver() public {
    RevertingRecipient revertingRecipient = new RevertingRecipient();
    cake.accessControl().setAdmin(address(splitter), address(this));

    payees.push(address(revertingRecipient));
    shares.push(50);
    splitter.replacePayees(payees, shares);

    erc20.transfer(address(splitter), 100e18);
    vm.expectRevert(abi.encodeWithSelector(RevertingRecipient.ReceiveError.selector));
    splitter.distribute();
  }

  function test_distribute_revertsWhenPaused() public {
    vm.startPrank(pauser);
    splitter.pause();
    vm.stopPrank();

    vm.expectRevert(bytes("Pausable: paused"));
    splitter.distribute();
  }

  function test_distribute_revertsOnInvalidReceiver() public {
    InvalidRecipient invalidRecipient = new InvalidRecipient();
    cake.accessControl().setAdmin(address(splitter), address(this));

    payees.push(address(invalidRecipient));
    shares.push(50);
    splitter.replacePayees(payees, shares);

    erc20.transfer(address(splitter), 100e18);
    vm.expectRevert(abi.encodeWithSelector(ERC20Splitter.InvalidReceiver.selector));
    splitter.distribute();
  }

  function test_replacePayees_replacesExistingPayeesAndShares() public {
    cake.accessControl().setAdmin(address(splitter), address(this));

    address newPayee = address(99);

    payees = new address[](2);
    payees[0] = eoaSplitRecipient;
    payees[1] = newPayee;

    shares = new uint256[](2);
    shares[0] = 10;
    shares[1] = 190;

    // Assert PayeeAdded emitted for each payee
    vm.expectEmit(true, true, true, true);
    emit PayeeAdded(payees[0], shares[0]);

    vm.expectEmit(true, true, true, true);
    emit PayeeAdded(payees[1], shares[1]);

    splitter.replacePayees(payees, shares);

    assertEq(splitter.totalShares(), 200);
    assertEq(splitter.payees(0), eoaSplitRecipient);
    assertEq(splitter.payees(1), newPayee);
    assertEq(splitter.shares(eoaSplitRecipient), 10);
    assertEq(splitter.shares(newPayee), 190);

    erc20.transfer(address(splitter), 100e18);
    splitter.distribute();

    assertEq(erc20.balanceOf(eoaSplitRecipient), 5e18);
    assertEq(erc20.balanceOf(newPayee), 95e18);
    assertEq(erc20.balanceOf(contractSplitRecipient), 0e18);
  }

  function test_replacePayees_revertsForNonAdmin(address caller) public {
    vm.assume(caller != cake.accessControl().admins(address(splitter)));

    vm.prank(caller);

    payees = new address[](1);
    payees[0] = address(99);

    shares = new uint256[](1);
    shares[0] = 100;

    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.RequiresAdmin.selector, address(splitter), caller)
    );
    splitter.replacePayees(payees, shares);
  }

  event PayeeAdded(address indexed payee, uint256 share);
}
