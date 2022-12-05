// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase, var-name-mixedcase

pragma solidity ^0.8.16;

import {Context} from "../../cake/Context.sol";
import {Router} from "../../cake/Router.sol";
import {AccessControl} from "../../cake/AccessControl.sol";
import {Keys} from "../../cake/Routing.sol";

import "../../protocol/core/membership/MembershipVault.sol";
import "../../protocol/core/membership/Epochs.sol";
import "../../protocol/core/ERCInterfaces.sol";
import "../../interfaces/IMembershipVault.sol";

import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../cake/helpers/CakeHelper.t.sol";

contract MembershipVaultTest is Test {
  address private constant TEST_OWNER = address(1);
  address private constant TEST_OWNER_2 = address(2);

  CakeHelper private cake;

  MembershipVault private vault;

  function setUp() public {
    cake = new CakeHelper(address(this));
    vault = new MembershipVault(cake.context());
    vault.initialize();

    cake.router().setContract(Keys.MembershipDirector, address(this));

    // Start tests at the beginning of an epoch
    vm.warp(Epochs.EPOCH_SECONDS);
  }

  //////////////////////////////////////////////////////////////////
  // ERC 721 + Enumerable

  function test_totalSupply() public {
    assertEq(vault.totalSupply(), 0);

    for (uint256 i = 0; i < 10; i++) {
      vault.adjustHoldings(TEST_OWNER, 0, 1);
      assertEq(vault.totalSupply(), 1);
    }

    vault.adjustHoldings(TEST_OWNER_2, 0, 1);
    assertEq(vault.totalSupply(), 2);
  }

  function test_ownerOf(address owner, uint256 amount) public withExistingPosition(owner, amount) {
    assertEq(vault.ownerOf(1), owner);
  }

  function test_ownerOf_invalidPosition() public {
    assertEq(vault.ownerOf(1), address(0));
  }

  function test_balanceOf(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    assertEq(vault.balanceOf(owner), 1);
  }

  function test_balanceOf_nonOwner() public {
    assertEq(vault.balanceOf(TEST_OWNER), 0);
  }

  function test_tokenOfOwnerByIndex(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    uint256 id = vault.tokenOfOwnerByIndex(owner, 0);

    assertEq(vault.currentValueOwnedBy(owner), 0);
    assertEq(vault.ownerOf(id), owner);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(vault.currentValueOwnedBy(owner), amount);
    assertEq(vault.ownerOf(id), owner);
  }

  function test_tokenOfOwnerByIndex_invalidOwner() public {
    vm.expectRevert(MembershipVault.NoTokensOwned.selector);
    vault.tokenOfOwnerByIndex(TEST_OWNER, 0);
  }

  function test_tokenOfOwnerByIndex_invalidIndex(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    vm.expectRevert(MembershipVault.OneTokenPerAddress.selector);
    vault.tokenOfOwnerByIndex(owner, 1);
  }

  function test_tokenByIndex(
    uint256 amount
  ) public withExistingPosition(address(1), amount) withExistingPosition(address(2), amount) {
    assertEq(vault.tokenByIndex(0), 1);
    assertEq(vault.currentValueOwnedBy(address(1)), 0);

    assertEq(vault.tokenByIndex(1), 2);
    assertEq(vault.currentValueOwnedBy(address(2)), 0);

    assertEq(vault.ownerOf(1), address(1));
    assertEq(vault.ownerOf(2), address(2));

    skip(Epochs.EPOCH_SECONDS);

    assertEq(vault.currentValueOwnedBy(address(1)), amount);
    assertEq(vault.currentValueOwnedBy(address(2)), amount);
  }

  function test_tokenByIndex_noTokens() public {
    vm.expectRevert(MembershipVault.IndexGreaterThanTokenSupply.selector);
    vault.tokenByIndex(0);
  }

  function test_tokenByIndex_invalidIndex() public withExistingPosition(address(1), 5) {
    vm.expectRevert(MembershipVault.IndexGreaterThanTokenSupply.selector);
    vault.tokenByIndex(1);
  }

  function test_supportsInterface(bytes4 otherInterface) public {
    vm.assume(otherInterface != ERCInterfaces.ERC721);
    vm.assume(otherInterface != ERCInterfaces.ERC721_ENUMERABLE);
    vm.assume(otherInterface != ERCInterfaces.ERC165);

    assertTrue(vault.supportsInterface(ERCInterfaces.ERC721));
    assertTrue(vault.supportsInterface(ERCInterfaces.ERC721_ENUMERABLE));
    assertTrue(vault.supportsInterface(ERCInterfaces.ERC165));

    assertFalse(vault.supportsInterface(otherInterface));
  }

  //////////////////////////////////////////////////////////////////
  // ERC721 Metadata

  function test_name() public {
    assertEq(vault.name(), "Goldfinch Membership");
  }

  function test_symbol() public {
    assertEq(vault.symbol(), "GFMEMBER");
  }

  function test_tokenURI()
    public
    withExistingPosition(address(2), 5)
    withExistingPosition(address(3), 6)
  {
    cake.accessControl().setAdmin(address(vault), address(this));
    vault.setBaseURI("http://www.some.com/");

    assertEq(vault.tokenURI(1), "http://www.some.com/1");
    assertEq(vault.tokenURI(2), "http://www.some.com/2");

    vm.expectRevert(abi.encodeWithSelector(MembershipVault.NonexistantToken.selector, 0));
    vault.tokenURI(0);

    vm.expectRevert(abi.encodeWithSelector(MembershipVault.NonexistantToken.selector, 3));
    vault.tokenURI(3);
  }

  function test_setBaseURI_requiresAdmin() public {
    vm.expectRevert();
    vault.setBaseURI("http://www.some.com/");
  }

  ////////////////////////////////////////////////////////////////////
  //// IMembershipVault

  function test_currentValueOwnedBy(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    assertEq(vault.currentValueOwnedBy(owner), 0);

    skip(Epochs.EPOCH_SECONDS);
    assertEq(vault.currentValueOwnedBy(owner), amount);
  }

  function test_currentValueOwnedBy_multipleUpdates(
    address owner,
    uint256 amount
  )
    public
    withExistingPosition(owner, amount)
    withExistingPosition(owner, amount + 1)
    withExistingPosition(owner, amount + 2)
  {
    assertEq(vault.currentValueOwnedBy(owner), 0);

    skip(Epochs.EPOCH_SECONDS);
    assertEq(vault.currentValueOwnedBy(owner), amount + 2);
  }

  function test_currentValueOwnedBy_invalidOwner() public {
    assertEq(vault.currentValueOwnedBy(TEST_OWNER), 0);
  }

  function test_currentTotal(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    assertEq(vault.currentTotal(), 0);

    skip(Epochs.EPOCH_SECONDS);
    assertEq(vault.currentTotal(), amount);
  }

  function test_currentTotal_multipleUpdates(
    address owner,
    uint256 amount
  )
    public
    withExistingPosition(owner, amount)
    withExistingPosition(owner, amount + 1)
    withExistingPosition(owner, amount + 2)
  {
    assertEq(vault.currentTotal(), 0);

    skip(Epochs.EPOCH_SECONDS);
    assertEq(vault.currentTotal(), amount + 2);
  }

  function test_checkpoint(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    // Epoch: 1
    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      assertEq(checkpoint.checkpointEpoch, Epochs.current());
      assertEq(checkpoint.eligibleAmount, 0);
      assertEq(checkpoint.nextEpochAmount, amount);
    }

    // Epoch: 11
    skip(Epochs.EPOCH_SECONDS * 10);

    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      assertEq(checkpoint.checkpointEpoch, 1);
      assertEq(checkpoint.eligibleAmount, 0);
      assertEq(checkpoint.nextEpochAmount, amount);
    }

    // Epoch: 21
    skip(Epochs.EPOCH_SECONDS * 10);

    // Adjusting holdings checkpoints internally
    vault.adjustHoldings(owner, 0, amount * 4);
    vault.adjustHoldings(owner, amount - 1, amount * 3);

    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      // current epoch because increase/decrease checkpoint internally
      assertEq(checkpoint.checkpointEpoch, 21);
      assertEq(checkpoint.eligibleAmount, amount - 1);
      assertEq(checkpoint.nextEpochAmount, amount * 3);
    }

    // Epoch: 24
    skip(Epochs.EPOCH_SECONDS * 3);

    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      assertEq(checkpoint.checkpointEpoch, 21);
      assertEq(checkpoint.eligibleAmount, amount - 1);
      assertEq(checkpoint.nextEpochAmount, amount * 3);
    }

    // Epoch: 34
    skip(Epochs.EPOCH_SECONDS * 10);

    vault.adjustHoldings(owner, amount * 3, amount * 3 + 1);

    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      // current epoch because increase/decrease checkpoint internally
      assertEq(checkpoint.checkpointEpoch, 34);
      assertEq(checkpoint.eligibleAmount, amount * 3);
      assertEq(checkpoint.nextEpochAmount, amount * 3 + 1);
    }

    // Epoch: 37
    skip(Epochs.EPOCH_SECONDS * 3);

    {
      Position memory checkpoint = vault.positionOwnedBy(owner);
      vault.checkpoint(owner);

      assertEq(checkpoint.checkpointEpoch, 34);
      assertEq(checkpoint.eligibleAmount, amount * 3);
      assertEq(checkpoint.nextEpochAmount, amount * 3 + 1);
    }
  }

  function increaseHoldings(address owner, uint256 amount) public {
    vm.assume(owner != address(0));
    vm.assume(0 < amount && amount < 1_000_000_000_000);

    vm.expectEmit(true, false, false, true);
    emit Transfer(address(0), owner, 1);

    vm.expectEmit(false, false, false, true);
    emit Checkpoint(vault.currentTotal());

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, 0, amount);

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(0, amount);

    assertEq(vault.totalSupply(), 0);
    assertEq(vault.balanceOf(owner), 0);

    uint256 id = vault.adjustHoldings(owner, 0, amount);

    assertEq(vault.totalSupply(), 1);
    assertEq(vault.ownerOf(id), owner);
    assertEq(vault.balanceOf(owner), 1);
    assertEq(vault.tokenOfOwnerByIndex(owner, 0), id);
    assertEq(vault.tokenByIndex(id), id);
    assertEq(vault.currentValueOwnedBy(owner), 0);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(vault.currentValueOwnedBy(owner), amount);
  }

  function test_increaseHoldings_midEpoch(address owner, uint256 amount) public {
    vm.assume(owner != address(0));
    vm.assume(0 < amount && amount < 1_000_000_000_000);

    skip(Epochs.EPOCH_SECONDS / 2);

    vm.expectEmit(true, false, false, true);
    emit Transfer(address(0), owner, 1);

    vm.expectEmit(false, false, false, true);
    emit Checkpoint(vault.currentTotal());

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, 0, amount);

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(0, amount);

    assertEq(vault.totalSupply(), 0);
    assertEq(vault.balanceOf(owner), 0);
    assertEq(vault.currentTotal(), 0);

    uint256 id = vault.adjustHoldings(owner, 0, amount);

    assertEq(vault.totalSupply(), 1);
    assertEq(vault.ownerOf(id), owner);
    assertEq(vault.balanceOf(owner), 1);
    assertEq(vault.tokenOfOwnerByIndex(owner, 0), id);
    assertEq(vault.tokenByIndex(id - 1), id);
    assertEq(vault.currentValueOwnedBy(owner), 0);
    assertEq(vault.currentTotal(), 0);

    skip(Epochs.EPOCH_SECONDS / 2);

    assertEq(vault.currentValueOwnedBy(owner), amount);
    assertEq(vault.currentTotal(), amount);
  }

  function test_deposit_zeroAddress() public {
    vm.expectRevert(MembershipVault.ZeroAddressInvalid.selector);
    vault.adjustHoldings(address(0), 0, 10);
  }

  function test_decreaseHoldings(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    // Force amount to be divisible by 8 so we can split amount into quarters for testing
    vm.assume(amount % 8 == 0);

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, 0, (amount * 3) / 4);

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(0, (amount * 3) / 4);

    vault.adjustHoldings(owner, 0, (amount * 3) / 4);

    // Still in the deposit epoch so there's no value accounted to the position
    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS);

    // Now that we're past the threshold epoch, the value is accounted for
    {
      uint256 expectedAmount = (amount * 3) / 4;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, amount / 2, amount / 2);

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(amount / 2, amount / 2);

    vault.adjustHoldings(owner, amount / 2, amount / 2);

    {
      uint256 expectedAmount = amount / 2;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, 0, 0);

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(0, 0);

    vault.adjustHoldings(owner, 0, 0);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }
  }

  function test_adjustHoldings_nextEpochGreater() public {
    vm.expectRevert(
      abi.encodeWithSelector(MembershipVault.InvalidHoldingsAdjustment.selector, 6, 3)
    );
    vault.adjustHoldings(address(5), 6, 3);
  }

  ////////////////////////////////////////////////////////////////////
  //// Scenarios

  function test_scenario_manyAlphaAdjustments() public {
    address owner = address(5);

    vault.adjustHoldings(owner, 3, 6);
    assertEq(vault.currentValueOwnedBy(owner), 3);

    vault.adjustHoldings(owner, 10, 11);
    assertEq(vault.currentValueOwnedBy(owner), 10);

    vault.adjustHoldings(owner, 4, 10);
    assertEq(vault.currentValueOwnedBy(owner), 4);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(vault.currentValueOwnedBy(owner), 10);

    vault.adjustHoldings(owner, 4, 4);
    assertEq(vault.currentValueOwnedBy(owner), 4);

    vault.adjustHoldings(owner, 1, 2);
    assertEq(vault.currentValueOwnedBy(owner), 1);

    vault.adjustHoldings(owner, 2, 2);
    assertEq(vault.currentValueOwnedBy(owner), 2);

    vault.adjustHoldings(owner, 6, 10000);
    assertEq(vault.currentValueOwnedBy(owner), 6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(vault.currentValueOwnedBy(owner), 10000);
  }

  function test_scenario_depositAndWithdraw_immediate(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    vm.expectEmit(true, false, false, true);
    emit VaultTotalUpdate(0, 0);

    vault.adjustHoldings(owner, 0, 0);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }
  }

  function test_scenario_depositAndWithdraw_multiEpoch(
    address owner,
    uint256 amount
  ) public withExistingPosition(owner, amount) {
    vm.assume(amount % 8 == 0);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS * 3);

    {
      uint256 expectedAmount = amount;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    vault.adjustHoldings(owner, amount / 2, amount / 2);

    {
      uint256 expectedAmount = amount / 2;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS);

    {
      uint256 expectedAmount = amount / 2;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS * 5);

    {
      uint256 expectedAmount = amount / 2;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    vault.adjustHoldings(owner, 0, 0);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }

    skip(Epochs.EPOCH_SECONDS * 5);

    {
      uint256 expectedAmount = 0;
      assertEq(vault.currentValueOwnedBy(owner), expectedAmount);
      assertEq(vault.currentTotal(), expectedAmount);
    }
  }

  function test_scenario_depositAndWithdraw_multiple() public {
    // Epoch 1.5
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      vault.adjustHoldings(TEST_OWNER, 0, 4);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 0);
      assertEq(vault.currentTotal(), 0);
    }

    // Epoch 2
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 4);
      assertEq(vault.currentTotal(), 4);
    }

    // Epoch 2.5
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      vault.adjustHoldings(TEST_OWNER, 4, 10);
      vault.adjustHoldings(TEST_OWNER_2, 0, 2);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 4);
      assertEq(vault.currentTotal(), 4);
    }

    // Epoch 3
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 10);
      assertEq(vault.currentValueOwnedBy(TEST_OWNER_2), 2);
      assertEq(vault.currentTotal(), 12);
    }

    // Epoch 3.5
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      vault.adjustHoldings(TEST_OWNER, 8, 8);
      vault.adjustHoldings(TEST_OWNER_2, 0, 0);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 8);
      assertEq(vault.currentValueOwnedBy(TEST_OWNER_2), 0);
      assertEq(vault.currentTotal(), 8);
    }

    // Epoch 4
    skip(Epochs.EPOCH_SECONDS / 2);

    {
      vault.adjustHoldings(TEST_OWNER, 6, 6);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 6);
      assertEq(vault.currentTotal(), 6);

      vault.adjustHoldings(TEST_OWNER, 6, 8);
      vault.adjustHoldings(TEST_OWNER_2, 0, 8);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 6);
      assertEq(vault.currentValueOwnedBy(TEST_OWNER_2), 0);
      assertEq(vault.currentTotal(), 6);

      vault.adjustHoldings(TEST_OWNER_2, 0, 0);

      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 6);
      assertEq(vault.currentValueOwnedBy(TEST_OWNER_2), 0);
      assertEq(vault.currentTotal(), 6);
    }

    // Far future
    skip(Epochs.EPOCH_SECONDS * 3);

    {
      assertEq(vault.currentValueOwnedBy(TEST_OWNER), 8);
      assertEq(vault.currentValueOwnedBy(TEST_OWNER_2), 0);
      assertEq(vault.currentTotal(), 8);
    }
  }

  //////////////////////////////////////////////////////////////////
  // Test Helpers

  modifier withExistingPosition(address owner, uint256 amount) {
    vm.assume(owner != address(0));
    vm.assume(0 < amount && amount < 1_000_000_000_000);

    if (vault.balanceOf(owner) == 0) {
      vm.expectEmit(true, false, false, true);
      emit Transfer(address(0), owner, 1);
    }

    vm.expectEmit(false, false, false, true);
    emit Checkpoint(vault.currentTotal());

    vm.expectEmit(true, false, false, true);
    emit AdjustedHoldings(owner, 0, amount);

    vault.adjustHoldings(owner, 0, amount);

    _;
  }

  // From IMembershipVault
  event AdjustedHoldings(address indexed owner, uint256 currentAmount, uint256 nextEpochAmount);
  event VaultTotalUpdate(uint256 currentAmount, uint256 nextEpochAmount);

  // From MembershipVault
  event Checkpoint(uint256 total);

  // From ERC721
  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
}
