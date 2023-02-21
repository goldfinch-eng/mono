// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "../../../protocol/core/membership/GFILedger.sol";
import "../../../protocol/core/membership/Epochs.sol";

import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";

contract MockERC20 is ERC20Upgradeable {
  constructor(uint256 initialSupply) {
    _mint(msg.sender, initialSupply);
  }
}

contract GFILedgerTest is Test {
  uint256 private constant MAX_GFI = 10_000_000_000;

  CakeHelper private cake;

  GFILedger private ledger;

  MockERC20 private gfi = new MockERC20(type(uint128).max);

  address private membershipOrchestrator;

  function setUp() public {
    cake = new CakeHelper(address(this));
    ledger = new GFILedger(cake.context());

    membershipOrchestrator = address(this);
    cake.router().setContract(Routing.Keys.MembershipOrchestrator, address(this));

    cake.router().setContract(Routing.Keys.GFI, address(gfi));

    vm.label(membershipOrchestrator, "Orchestrator");
    vm.label(address(this), "ContractTester");
  }

  function test_tokenByIndex(
    uint256 amount
  ) public withDeposit(address(1), amount) withDeposit(address(2), amount) {
    assertEq(ledger.tokenByIndex(0), 1);
    assertEq(ledger.balanceOf(address(1)), 1);

    assertEq(ledger.tokenByIndex(1), 2);
    assertEq(ledger.balanceOf(address(2)), 1);
  }

  function test_tokenByIndex_noTokens() public {
    vm.expectRevert(GFILedger.IndexGreaterThanTokenSupply.selector);
    ledger.tokenByIndex(0);
  }

  function test_deposit(address owner, uint256 amount) public {
    {
      vm.assume(amount < MAX_GFI);
      vm.assume(amount > 0);

      vm.prank(membershipOrchestrator);
      gfi.approve(address(ledger), type(uint256).max);

      // Transfer two times the amount as we do two deposits
      gfi.transfer(address(membershipOrchestrator), amount * 2);
    }

    gfi.transfer(address(ledger), amount);

    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(
        ERC20Upgradeable.transferFrom.selector,
        membershipOrchestrator,
        address(ledger),
        amount
      )
    );

    vm.expectEmit(true, true, false, true);
    emit GFIDeposit(owner, ledger.totalSupply() + 1, amount);

    uint256 id = ledger.deposit(owner, amount);
    assertEq(ledger.balanceOf(owner), 1);
    assertEq(ledger.ownerOf(id), owner);

    (uint256 eligible, uint256 total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, amount);

    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(
        ERC20Upgradeable.transferFrom.selector,
        membershipOrchestrator,
        address(ledger),
        amount
      )
    );

    vm.expectEmit(true, true, false, true);
    emit GFIDeposit(owner, ledger.totalSupply() + 1, amount);

    uint256 id2 = ledger.deposit(owner, amount);
    assertEq(ledger.balanceOf(owner), 2);
    assertEq(ledger.ownerOf(id2), owner);

    (eligible, total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, amount * 2);
  }

  function testFail_deposit_zeroAmount(address owner) public {
    ledger.deposit(owner, 0);
  }

  function testFail_deposit_missingGFIPermission() public {
    ledger.deposit(address(1), 10);
  }

  function testFail_deposit_orchestratorNoGFI() public {
    // Give up all GFI
    gfi.transfer(address(0), gfi.balanceOf(address(this)));

    // Approve ledger to use GFI
    gfi.approve(address(ledger), type(uint256).max);

    // Try to deposit GFI
    ledger.deposit(address(1), 10);
  }

  function test_withdraw(address owner, uint256 amount) public withDeposit(owner, amount) {
    vm.assume(amount % 2 == 0);

    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(ERC20Upgradeable.transfer.selector, owner, amount / 2)
    );

    vm.expectEmit(true, true, false, true);
    emit GFIWithdrawal(owner, 1, amount / 2, amount / 2, block.timestamp);

    ledger.withdraw(1, amount / 2);

    assertEq(ledger.balanceOf(owner), 1);
    assertEq(ledger.ownerOf(1), owner);
    (uint256 eligible, uint256 total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, amount / 2);

    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(ERC20Upgradeable.transfer.selector, owner, amount / 2)
    );

    vm.expectEmit(true, true, false, true);
    emit GFIWithdrawal(owner, 1, amount / 2, 0, block.timestamp);

    ledger.withdraw(1, amount / 2);

    assertEq(ledger.balanceOf(owner), 0);
    assertEq(ledger.ownerOf(1), address(0));
  }

  function test_withdraw_exact(address owner, uint256 amount) public withDeposit(owner, amount) {
    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(ERC20Upgradeable.transfer.selector, owner, amount)
    );

    vm.expectEmit(true, true, false, true);
    emit GFIWithdrawal(owner, 1, amount, 0, block.timestamp);

    ledger.withdraw(1, amount);

    assertEq(ledger.balanceOf(owner), 0);
    assertEq(ledger.ownerOf(1), address(0));
  }

  function test_withdraw_all(address owner, uint256 amount) public withDeposit(owner, amount) {
    vm.expectCall(
      address(gfi),
      abi.encodeWithSelector(ERC20Upgradeable.transfer.selector, owner, amount)
    );

    vm.expectEmit(true, true, false, true);
    emit GFIWithdrawal(owner, 1, amount, 0, block.timestamp);

    ledger.withdraw(1);

    assertEq(ledger.balanceOf(owner), 0);
    assertEq(ledger.ownerOf(1), address(0));
  }

  function test_withdraw_moreThanOwned(
    address owner,
    uint256 amount
  ) public withDeposit(owner, amount) {
    vm.expectRevert(
      abi.encodeWithSelector(GFILedger.InvalidWithdrawAmount.selector, amount + 1, amount)
    );
    ledger.withdraw(1, amount + 1);
  }

  function test_balanceOf(
    address owner,
    address owner2,
    uint256 amount
  ) public withDeposit(owner, amount) withDeposit(owner2, amount) withDeposit(owner, amount) {
    vm.assume(owner != owner2);

    assertEq(ledger.balanceOf(owner), 2);
    assertEq(ledger.balanceOf(owner2), 1);

    (uint256 eligible, uint256 total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, amount * 2);

    (eligible, total) = ledger.totalsOf(owner2);
    assertEq(eligible, 0);
    assertEq(total, amount);
  }

  function test_ownerOf(
    address owner,
    address owner2,
    uint256 amount
  ) public withDeposit(owner, amount) withDeposit(owner2, amount) withDeposit(owner, amount) {
    vm.assume(owner != owner2);

    assertEq(ledger.ownerOf(1), owner);
    assertEq(ledger.ownerOf(2), owner2);
    assertEq(ledger.ownerOf(3), owner);
  }

  function test_totalsOf(address owner, uint256 amount) public withDeposit(owner, amount) {
    (uint256 beforeAmount, uint256 afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, 0);
    assertEq(afterAmount, amount);

    skip(Epochs.EPOCH_SECONDS);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount);

    skip(Epochs.EPOCH_SECONDS * 3);

    gfi.transfer(address(membershipOrchestrator), amount);
    ledger.deposit(owner, amount);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount * 2);

    skip(Epochs.EPOCH_SECONDS * 2);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount * 2);
    assertEq(afterAmount, amount * 2);

    ledger.withdraw(1);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount);

    skip(Epochs.EPOCH_SECONDS);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount);

    gfi.transfer(address(membershipOrchestrator), amount);
    uint256 id = ledger.deposit(owner, amount);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount * 2);

    ledger.withdraw(id);

    (beforeAmount, afterAmount) = ledger.totalsOf(owner);

    assertEq(beforeAmount, amount);
    assertEq(afterAmount, amount);
  }

  function test_scenario(
    address owner,
    uint256 amount
  ) public withDeposit(owner, amount) withDeposit(owner, amount) withDeposit(owner, amount) {
    vm.assume(amount % 4 == 0);

    assertEq(ledger.balanceOf(owner), 3);
    assertEq(ledger.ownerOf(1), owner);
    assertEq(ledger.ownerOf(2), owner);
    assertEq(ledger.ownerOf(3), owner);

    (uint256 eligible, uint256 total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, amount * 3);

    skip(Epochs.EPOCH_SECONDS);

    (eligible, total) = ledger.totalsOf(owner);
    assertEq(eligible, amount * 3);
    assertEq(total, amount * 3);

    ledger.withdraw(1, amount);
    ledger.withdraw(2, amount / 2);
    ledger.withdraw(3, amount / 2);

    (eligible, total) = ledger.totalsOf(owner);
    assertEq(eligible, amount);
    assertEq(total, amount);

    assertEq(ledger.balanceOf(owner), 2);
    assertEq(ledger.ownerOf(1), address(0));
    assertEq(ledger.ownerOf(2), owner);
    assertEq(ledger.ownerOf(3), owner);

    ledger.withdraw(3, amount / 4);
    ledger.withdraw(2, amount / 2);
    ledger.withdraw(3, amount / 4);

    assertEq(ledger.balanceOf(owner), 0);
    assertEq(ledger.ownerOf(1), address(0));
    assertEq(ledger.ownerOf(2), address(0));
    assertEq(ledger.ownerOf(3), address(0));

    (eligible, total) = ledger.totalsOf(owner);
    assertEq(eligible, 0);
    assertEq(total, 0);
  }

  //////////////////////////////////////////////////////////////////
  // Helpers

  modifier withDeposit(address owner, uint256 amount) {
    vm.assume(amount > 0);
    vm.assume(amount < MAX_GFI);

    vm.assume(owner != address(0));
    vm.assume(owner != address(ledger));

    vm.prank(membershipOrchestrator);
    gfi.approve(address(ledger), type(uint256).max);

    gfi.transfer(address(membershipOrchestrator), amount);

    vm.expectEmit(true, true, false, true);
    emit GFIDeposit(owner, ledger.totalSupply() + 1, amount);

    ledger.deposit(owner, amount);

    _;
  }

  event GFIDeposit(address indexed owner, uint256 indexed tokenId, uint256 amount);
  event GFIWithdrawal(
    address indexed owner,
    uint256 indexed tokenId,
    uint256 withdrawnAmount,
    uint256 remainingAmount,
    uint256 depositTimestamp
  );
}
