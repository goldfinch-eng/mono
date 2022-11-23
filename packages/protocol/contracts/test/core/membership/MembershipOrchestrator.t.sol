// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.16;

import "openzeppelin-contracts-0-8-x/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

import "../../../cake/Routing.sol" as Routing;
import {Base} from "../../../cake/Base.sol";

import "../../../interfaces/IMembershipOrchestrator.sol";
import {IStakingRewards, StakedPosition, StakedPositionType} from "../../../interfaces/IStakingRewards.sol";

import {FiduConversions} from "../../../library/FiduConversions.sol";

import {MembershipOrchestrator} from "../../../protocol/core/MembershipOrchestrator.sol";
import {MembershipDirector} from "../../../protocol/core/membership/MembershipDirector.sol";
import {MembershipLedger} from "../../../protocol/core/membership/MembershipLedger.sol";
import {MembershipVault} from "../../../protocol/core/membership/MembershipVault.sol";
import {MembershipLedger} from "../../../protocol/core/membership/MembershipLedger.sol";
import {MembershipCollector} from "../../../protocol/core/membership/MembershipCollector.sol";
import {CapitalLedger} from "../../../protocol/core/membership/CapitalLedger.sol";
import {GFILedger} from "../../../protocol/core/membership/GFILedger.sol";
import {ERC20Splitter} from "../../../protocol/core/membership/ERC20Splitter.sol";

import "../../../protocol/core/membership/Epochs.sol";
import {AccessControl} from "../../../cake/AccessControl.sol";

import {Test, stdError} from "forge-std/Test.sol";

import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";

import {console} from "forge-std/console.sol";

using Routing.Context for Context;

contract MembershipOrchestratorTest is Test {
  CakeHelper private cake;

  MembershipOrchestrator private orchestrator;

  MockedStakingRewards private stakingRewards;
  MockERC20 private gfi;
  MockERC20 private fidu;
  MockERC20 private usdc;

  address private governance = address(2);
  address private pauser = address(3);

  function setUp() public {
    cake = new CakeHelper(address(this));
    orchestrator = new MembershipOrchestrator(cake.context());
    orchestrator.initialize();

    // Set contracts
    //

    cake.router().setContract(Routing.Keys.MembershipOrchestrator, address(orchestrator));
    cake.router().setContract(Routing.Keys.MembershipDirector, address(new MembershipDirector(cake.context())));
    cake.router().setContract(Routing.Keys.GFILedger, address(new GFILedger(cake.context())));
    cake.router().setContract(Routing.Keys.CapitalLedger, address(new CapitalLedger(cake.context())));

    stakingRewards = new MockedStakingRewards();
    stakingRewards.init();
    cake.router().setContract(Routing.Keys.StakingRewards, address(stakingRewards));

    cake.router().setContract(Routing.Keys.SeniorPool, address(new MockedSeniorPool(cake.context())));
    cake.router().setContract(Routing.Keys.MembershipVault, address(new MembershipVault(cake.context())));
    cake.router().setContract(Routing.Keys.MembershipCollector, address(new MembershipCollector(cake.context(), 0)));
    cake.router().setContract(Routing.Keys.MembershipLedger, address(new MembershipLedger(cake.context())));

    gfi = new MockERC20(type(uint256).max);
    cake.router().setContract(Routing.Keys.GFI, address(gfi));

    fidu = new MockERC20(type(uint256).max);
    cake.router().setContract(Routing.Keys.FIDU, address(fidu));

    usdc = new MockERC20(type(uint256).max);
    cake.router().setContract(Routing.Keys.USDC, address(usdc));

    MembershipLedger membershipLedger = new MembershipLedger(cake.context());
    membershipLedger.initialize();
    cake.router().setContract(Routing.Keys.MembershipLedger, address(membershipLedger));

    cake.router().setContract(Routing.Keys.PauserAdmin, pauser);

    address[] memory _payees = new address[](2);
    _payees[0] = governance;
    _payees[1] = cake.contractFor(Routing.Keys.MembershipCollector);

    uint256[] memory _shares = new uint256[](2);
    _shares[0] = 1;
    _shares[1] = 1;

    ERC20Splitter reserveSplitter = new ERC20Splitter(cake.context(), IERC20(address(usdc)));
    cake.accessControl().setAdmin(address(reserveSplitter), address(this));
    reserveSplitter.replacePayees(_payees, _shares);
    cake.accessControl().setAdmin(address(reserveSplitter), address(0));
    cake.router().setContract(Routing.Keys.ReserveSplitter, address(reserveSplitter));

    vm.label(address(this), "ContractTester");
    vm.label(cake.contractFor(Routing.Keys.CapitalLedger), "CapitalLedger");
    vm.label(cake.contractFor(Routing.Keys.GFILedger), "GFILedger");

    // Give the senior pool some fidu
    fidu.transfer(cake.contractFor(Routing.Keys.SeniorPool), 50_000e18);

    // Set start epoch at exactly 2
    vm.warp(Epochs.EPOCH_SECONDS * 2);
  }

  function test_depositGFI() public {
    gfi.approve(address(orchestrator), 20);
    assertEq(depositGFI(address(this), 20), 1);

    gfi.approve(address(orchestrator), 30);
    assertEq(depositGFI(address(this), 30), 2);

    assertEq(orchestrator.votingPower(address(this)), 50);

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 50);
  }

  function test_depositCapitalERC721() public {
    assertEq(depositStakedFidu(address(this), 15e18), 1);
    assertEq(depositStakedFidu(address(this), 21e18), 2);

    (uint256 eligible, uint256 total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 36e6); // Capital denominated in USDC, share price is 1
  }

  function test_deposit() public {
    stakingRewards.mint(StakedPositionType.Fidu, 15e18);
    stakingRewards.mint(StakedPositionType.Fidu, 21e18);

    stakingRewards.approve(address(orchestrator), 1);
    stakingRewards.approve(address(orchestrator), 2);
    gfi.approve(address(orchestrator), 5e18);

    CapitalDeposit[] memory capitalDeposits = new CapitalDeposit[](2);
    capitalDeposits[0] = CapitalDeposit({assetAddress: address(stakingRewards), id: 1});
    capitalDeposits[1] = CapitalDeposit({assetAddress: address(stakingRewards), id: 2});

    orchestrator.deposit(Deposit({gfi: 5e18, capitalDeposits: capitalDeposits}));

    assertEq(orchestrator.votingPower(address(this)), 5e18);

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 5e18);

    (eligible, total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 36e6); // Capital denominated in USDC, share price is 1

    (eligible, total) = orchestrator.memberScoreOf(address(this));
    assertEq(eligible, 0);
    assertEq(total, 13416407864998737858); // 36^0.5 * 5^0.5 = 13.4164
  }

  function test_deposit_noGFI() public {
    stakingRewards.mint(StakedPositionType.Fidu, 15e18);
    stakingRewards.mint(StakedPositionType.Fidu, 21e18);

    stakingRewards.approve(address(orchestrator), 1);
    stakingRewards.approve(address(orchestrator), 2);

    CapitalDeposit[] memory capitalDeposits = new CapitalDeposit[](2);
    capitalDeposits[0] = CapitalDeposit({assetAddress: address(stakingRewards), id: 1});
    capitalDeposits[1] = CapitalDeposit({assetAddress: address(stakingRewards), id: 2});

    orchestrator.deposit(Deposit({gfi: 0, capitalDeposits: capitalDeposits}));

    assertEq(orchestrator.votingPower(address(this)), 0);

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);

    (eligible, total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 36e6); // Capital denominated in USDC, share price is 1

    (eligible, total) = orchestrator.memberScoreOf(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);
  }

  function test_deposit_invalidAsset() public {
    stakingRewards.mint(StakedPositionType.Fidu, 15e18);
    stakingRewards.mint(StakedPositionType.Fidu, 21e18);

    stakingRewards.approve(address(orchestrator), 1);
    stakingRewards.approve(address(orchestrator), 2);
    gfi.approve(address(orchestrator), 5e18);

    CapitalDeposit[] memory capitalDeposits = new CapitalDeposit[](3);
    capitalDeposits[0] = CapitalDeposit({assetAddress: address(stakingRewards), id: 1});
    capitalDeposits[1] = CapitalDeposit({assetAddress: address(stakingRewards), id: 2});
    capitalDeposits[2] = CapitalDeposit({assetAddress: address(5), id: 2}); // The hidden, invalid asset!

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.UnsupportedAssetAddress.selector, (address(5))));
    orchestrator.deposit(Deposit({gfi: 5e18, capitalDeposits: capitalDeposits}));
  }

  function test_deposit_paused() public {
    stakingRewards.mint(StakedPositionType.Fidu, 15e18);
    stakingRewards.mint(StakedPositionType.Fidu, 21e18);

    stakingRewards.approve(address(orchestrator), 1);
    stakingRewards.approve(address(orchestrator), 2);
    gfi.approve(address(orchestrator), 5e18);

    CapitalDeposit[] memory capitalDeposits = new CapitalDeposit[](2);
    capitalDeposits[0] = CapitalDeposit({assetAddress: address(stakingRewards), id: 1});
    capitalDeposits[1] = CapitalDeposit({assetAddress: address(stakingRewards), id: 2});

    vm.startPrank(pauser);
    orchestrator.pause();
    vm.stopPrank();

    vm.expectRevert(bytes("Pausable: paused"));
    orchestrator.deposit(Deposit({gfi: 5e18, capitalDeposits: capitalDeposits}));
  }

  function test_withdrawGFI() public withGFIDeposit(20) {
    uint256 balanceBefore = gfi.balanceOf(address(this));

    withdrawGFI(address(this), 1);

    assertEq(balanceBefore + 20, gfi.balanceOf(address(this)));

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);
  }

  function test_withdrawGFI_notOwner() public withOtherGFIDeposit(address(5), 50) {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 50});

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawUnownedAsset.selector, address(this)));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: new uint256[](0)}));
  }

  function test_withdrawCapital() public withStakedFiduDeposit(21e18) {
    assertEq(stakingRewards.ownerOf(1), cake.contractFor(Routing.Keys.CapitalLedger));

    withdrawCapitalERC721(address(this), 1);

    assertEq(stakingRewards.ownerOf(1), address(this));

    (uint256 eligible, uint256 total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);
  }

  function test_withdrawCapital_notOwner() public withOtherStakedFiduDeposit(address(5), 21e18) {
    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawUnownedAsset.selector, address(this)));
    withdrawCapitalERC721(address(this), 1);
  }

  function test_withdraw() public withGFIDeposit(20) withStakedFiduDeposit(21e18) {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});

    uint256[] memory capitalPositions = new uint256[](1);
    capitalPositions[0] = 1;

    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);

    (eligible, total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0); // Capital denominated in USDC, share price is 1
  }

  function test_withdraw_multiple()
    public
    withGFIDeposit(20)
    withGFIDeposit(20)
    withGFIDeposit(20)
    withStakedFiduDeposit(21e18)
    withStakedFiduDeposit(22e18)
    withStakedFiduDeposit(22e18)
    withStakedFiduDeposit(22e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](3);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});
    gfiPositions[1] = ERC20Withdrawal({id: 2, amount: 20});
    gfiPositions[2] = ERC20Withdrawal({id: 3, amount: 20});

    uint256[] memory capitalPositions = new uint256[](4);
    capitalPositions[0] = 1;
    capitalPositions[1] = 2;
    capitalPositions[2] = 3;
    capitalPositions[3] = 4;

    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);

    (eligible, total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0); // Capital denominated in USDC, share price is 1
  }

  function test_withdraw_partialGFI()
    public
    withGFIDeposit(20)
    withGFIDeposit(20)
    withGFIDeposit(20)
    withStakedFiduDeposit(21e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](2);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 10});
    gfiPositions[1] = ERC20Withdrawal({id: 2, amount: 20});

    uint256[] memory capitalPositions = new uint256[](1);
    capitalPositions[0] = 1;

    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 30);

    (eligible, total) = orchestrator.totalCapitalHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0); // Capital denominated in USDC, share price is 1
  }

  function test_withdraw_nothingRequested() public {
    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.MustWithdrawSomething.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: new ERC20Withdrawal[](0), capitalPositions: new uint256[](0)}));
  }

  function test_withdraw_differentGFIOwners()
    public
    withGFIDeposit(20)
    withOtherGFIDeposit(address(5), 20)
    withStakedFiduDeposit(21e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](2);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});
    gfiPositions[1] = ERC20Withdrawal({id: 2, amount: 20});

    uint256[] memory capitalPositions = new uint256[](1);
    capitalPositions[0] = 1;

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawForMultipleOwners.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));
  }

  function test_withdraw_notGFIOwner() public withOtherGFIDeposit(address(5), 20) {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawUnownedAsset.selector, address(this)));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: new uint256[](0)}));
  }

  function test_withdraw_sameGFIPosition() public withGFIDeposit(20) {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](2);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 10});
    gfiPositions[1] = ERC20Withdrawal({id: 1, amount: 10});

    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: new uint256[](0)}));

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(address(this));
    assertEq(eligible, 0);
    assertEq(total, 0);
  }

  function test_withdraw_sameGFIPosition_overwithdraw() public withGFIDeposit(20) {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](3);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 10});
    gfiPositions[1] = ERC20Withdrawal({id: 1, amount: 10});
    gfiPositions[2] = ERC20Withdrawal({id: 1, amount: 10});

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawForAddress0.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: new uint256[](0)}));
  }

  function test_withdraw_differentCapitalOwners()
    public
    withGFIDeposit(20)
    withStakedFiduDeposit(21e18)
    withOtherStakedFiduDeposit(address(5), 2e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});

    uint256[] memory capitalPositions = new uint256[](2);
    capitalPositions[0] = 1;
    capitalPositions[1] = 2;

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawForMultipleOwners.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));
  }

  function test_withdraw_notCapitalOwner() public withOtherStakedFiduDeposit(address(5), 2e18) {
    uint256[] memory capitalPositions = new uint256[](1);
    capitalPositions[0] = 1;

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawUnownedAsset.selector, address(this)));
    orchestrator.withdraw(Withdrawal({gfiPositions: new ERC20Withdrawal[](0), capitalPositions: capitalPositions}));
  }

  function test_withdraw_sameCapitalPosition() public withStakedFiduDeposit(21e18) {
    uint256[] memory capitalPositions = new uint256[](2);
    capitalPositions[0] = 1;
    capitalPositions[1] = 1;

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawForAddress0.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: new ERC20Withdrawal[](0), capitalPositions: capitalPositions}));
  }

  function test_withdraw_invalidId()
    public
    withGFIDeposit(20)
    withStakedFiduDeposit(21e18)
    withStakedFiduDeposit(2e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 20});

    uint256[] memory capitalPositions = new uint256[](3);
    capitalPositions[0] = 1;
    capitalPositions[1] = 2;
    capitalPositions[2] = 100; // Invalid id!

    vm.expectRevert(abi.encodeWithSelector(MembershipOrchestrator.CannotWithdrawForAddress0.selector));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));
  }

  function test_withdraw_moreGFIThanOwned()
    public
    withGFIDeposit(20)
    withStakedFiduDeposit(21e18)
    withStakedFiduDeposit(2e18)
  {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: 1, amount: 30});

    uint256[] memory capitalPositions = new uint256[](2);
    capitalPositions[0] = 1;
    capitalPositions[1] = 2;

    vm.expectRevert(abi.encodeWithSelector(GFILedger.InvalidWithdrawAmount.selector, 30, 20));
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));
  }

  function test_withdraw_paused() public {
    vm.startPrank(pauser);
    orchestrator.pause();
    vm.stopPrank();

    vm.expectRevert(bytes("Pausable: paused"));
    orchestrator.withdraw(Withdrawal({gfiPositions: new ERC20Withdrawal[](0), capitalPositions: new uint256[](0)}));
  }

  function test_collectRewards() public {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    usdc.transfer(reserveSplitter, 20e6);
    depositGFI(address(this), 5e18);

    skip(Epochs.EPOCH_SECONDS);

    usdc.transfer(reserveSplitter, 20e6);
    depositStakedFidu(address(this), 6e18);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.collectRewards(), 0); // Wasn't present for the entire previous epoch
    usdc.transfer(reserveSplitter, 20e6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.collectRewards(), 10e18);
  }

  function test_collectRewards_noRewards() public withGFIDeposit(5e18) withStakedFiduDeposit(6e18) {
    skip(Epochs.EPOCH_SECONDS);
    skip(Epochs.EPOCH_SECONDS);

    vm.expectEmit(true, false, false, true);
    emit RewardsClaimed(address(this), 0);

    assertEq(orchestrator.collectRewards(), 0);
  }

  function test_collectRewards_singleEpoch() public withGFIDeposit(5e18) withStakedFiduDeposit(6e18) {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS);

    vm.expectEmit(true, false, false, true);
    emit RewardsClaimed(address(this), 0);

    assertEq(orchestrator.collectRewards(), 0);
    usdc.transfer(reserveSplitter, 20e6);

    skip(Epochs.EPOCH_SECONDS);

    vm.expectEmit(true, false, false, true);
    emit RewardsClaimed(address(this), 10e18);

    assertEq(orchestrator.collectRewards(), 10e18);
  }

  function test_collectRewards_multiEpoch() public withGFIDeposit(5e18) withStakedFiduDeposit(6e18) {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    usdc.transfer(reserveSplitter, 20e6);

    skip(Epochs.EPOCH_SECONDS);

    usdc.transfer(reserveSplitter, 10e6);

    skip(Epochs.EPOCH_SECONDS);

    usdc.transfer(reserveSplitter, 12e6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.collectRewards(), 21e18);
    usdc.transfer(reserveSplitter, 6e6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.collectRewards(), 3e18);
    usdc.transfer(reserveSplitter, 6e6);

    skip(Epochs.EPOCH_SECONDS * 6);

    assertEq(orchestrator.collectRewards(), 3e18);
    usdc.transfer(reserveSplitter, 6e6);

    skip(Epochs.EPOCH_SECONDS * 6);
    orchestrator.finalizeEpochs();

    assertEq(orchestrator.claimableRewards(address(this)), 3e18);
    assertEq(orchestrator.collectRewards(), 3e18);
  }

  function test_collectRewards_multiEpoch_multiInteraction() public {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS);

    depositGFI(address(this), 5e18);
    depositGFI(address(this), 5e18);
    usdc.transfer(reserveSplitter, 20e6);

    skip(Epochs.EPOCH_SECONDS);

    withdrawGFI(address(this), 1);
    depositStakedFidu(address(this), 6e18);
    withdrawCapitalERC721(address(this), 1);
    assertEq(orchestrator.claimableRewards(address(this)), 0);
    assertEq(orchestrator.collectRewards(), 0);
    usdc.transfer(reserveSplitter, 10e6);

    skip(Epochs.EPOCH_SECONDS);

    depositStakedFidu(address(this), 6e18);
    assertEq(orchestrator.claimableRewards(address(this)), 0);
    assertEq(orchestrator.collectRewards(), 0); // only had a gfi position
    usdc.transfer(reserveSplitter, 12e6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.claimableRewards(address(this)), 0);
    assertEq(orchestrator.collectRewards(), 0); // staked fidu wasn't in for all of last epoch
    usdc.transfer(reserveSplitter, 6e6);

    skip(Epochs.EPOCH_SECONDS);

    withdrawGFI(address(this), 2);
    assertEq(orchestrator.claimableRewards(address(this)), 3e18);
    assertEq(orchestrator.collectRewards(), 3e18);
    usdc.transfer(reserveSplitter, 6e6);

    skip(Epochs.EPOCH_SECONDS * 6);

    assertEq(orchestrator.claimableRewards(address(this)), 0);
    assertEq(orchestrator.collectRewards(), 0); // didn't have a gfi position
  }

  function test_collectRewards_multiEpoch_multiInteraction_multiUser() public {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    address user1 = address(1);
    address user2 = address(2);
    address user3 = address(3);

    assertEq(orchestrator.claimableRewards(user1), 0);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);

    //////////////////////////////////////////////////////////////
    // Epoch 3
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    uint256 gfi_user1_id1 = depositGFI(user1, 5e18);
    uint256 captialERC721_user1_id1 = depositStakedFidu(user1, 6e18);

    usdc.transfer(reserveSplitter, 10e6);

    assertEq(orchestrator.claimableRewards(user1), 0);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);

    //////////////////////////////////////////////////////////////
    // Epoch 4
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    depositGFI(user2, 10e18);
    depositGFI(user3, 20e18);

    usdc.transfer(reserveSplitter, 20e6);

    assertEq(orchestrator.claimableRewards(user1), 0);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);

    //////////////////////////////////////////////////////////////
    // Epoch 5
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    uint256 captialERC721_user2_id1 = depositStakedFidu(user2, 6e18);

    usdc.transfer(reserveSplitter, 30e6);

    assertEq(orchestrator.claimableRewards(user1), 10e18);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);

    //////////////////////////////////////////////////////////////
    // Epoch 6
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    assertEq(orchestrator.claimableRewards(user1), 10e18 + 15e18);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);

    uint256 captialERC721_user2_id2 = depositStakedFidu(user2, 6e18);

    usdc.transfer(reserveSplitter, 40e6);

    //////////////////////////////////////////////////////////////
    // Epoch 7
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    // rewards to distribute: 40 / 2 = 20
    // user1: (5)^0.5 * (6)^0.5 = 5.447 -> 41.28% -> 8.256
    // user2: 10^0.5 * 6^0.5 = 7.746 -> 58.72% -> 11.744
    assertApproxEqAbs(orchestrator.claimableRewards(user1), 25e18 + 82e17, 1e18);
    vm.prank(user2);
    assertApproxEqAbs(orchestrator.collectRewards(), 117e17, 1e18);
    assertEq(orchestrator.claimableRewards(user3), 0);

    usdc.transfer(reserveSplitter, 60e6);

    //////////////////////////////////////////////////////////////
    // Epoch 8
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    // rewards to distribute: 60 / 2 = 30
    // user1: (5)^0.5 * (6)^0.5 = 5.447 -> 33.21% -> 9.963
    // user2: 10^0.5 * (6+6)^0.5 = 10.954 -> 66.79% -> 20.037
    vm.prank(user1);
    assertApproxEqAbs(orchestrator.collectRewards(), 25e18 + 82e17 + 99e17, 1e18);
    assertApproxEqAbs(orchestrator.claimableRewards(user2), 20e18, 1e18);
    assertEq(orchestrator.claimableRewards(user3), 0);

    usdc.transfer(reserveSplitter, 80e6);

    depositGFI(user3, 40e18);
    depositGFI(user3, 60e18);
    depositStakedFidu(user3, 10e18);
    depositStakedFidu(user3, 10e18);

    withdrawCapitalERC721(user2, captialERC721_user2_id2);

    //////////////////////////////////////////////////////////////
    // Epoch 9
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    // rewards to distribute: 80 / 2 = 40
    // user1: 5^0.5 * (6)^0.5 = 5.477 -> 41.42% -> 16.568
    // user2: 10^0.5 * (6+6-6)^0.5 = 7.746 -> 58.57% -> 23.431
    assertApproxEqAbs(orchestrator.claimableRewards(user1), 166e17, 1e18);
    assertApproxEqAbs(orchestrator.claimableRewards(user2), 20e18 + 234e17, 1e18);
    assertEq(orchestrator.claimableRewards(user3), 0);

    withdrawGFI(user1, gfi_user1_id1, 2e18);

    usdc.transfer(reserveSplitter, 100e6);

    //////////////////////////////////////////////////////////////
    // Epoch 10
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    // rewards to distribute: 100 / 2 = 50
    // user1: (5-2)^0.5 * (6)^0.5 = 4.242  -> 6.95% ->   3.47
    // user2: 10^0.5 * 6^0.5      = 7.746  -> 12.70% ->  6.35
    // user3: 120^0.5 * 20^0.5    = 48.989 -> 80.35% -> 40.18
    assertApproxEqAbs(orchestrator.claimableRewards(user1), 166e17 + 34e17, 1e18);
    vm.prank(user2);
    assertApproxEqAbs(orchestrator.collectRewards(), 20e18 + 234e17 + 63e17, 1e18);
    assertApproxEqAbs(orchestrator.claimableRewards(user3), 40e18, 1e18);

    withdrawGFI(user1, gfi_user1_id1, 3e18);

    usdc.transfer(reserveSplitter, 200e6);

    //////////////////////////////////////////////////////////////
    // Epoch 11
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    // rewards to distribute: 100 / 2 = 100
    // user1: same as before, fully withdrawn
    // user2: 10^0.5 * 6^0.5   = 7.746  -> 13.65% -> 13.65
    // user3: 120^0.5 * 20^0.5 = 48.989 -> 86.35% -> 86.35
    assertApproxEqAbs(orchestrator.claimableRewards(user1), 166e17 + 34e17, 1e18);
    assertApproxEqAbs(orchestrator.claimableRewards(user2), 136e17, 1e18);
    assertApproxEqAbs(orchestrator.claimableRewards(user3), 40e18 + 866e17, 1e18);

    //////////////////////////////////////////////////////////////
    // Epoch 11
    //////////////////////////////////////////////////////////////
    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    vm.prank(user1);
    assertApproxEqAbs(orchestrator.collectRewards(), 166e17 + 34e17, 1e18);
    vm.prank(user2);
    assertApproxEqAbs(orchestrator.collectRewards(), 136e17, 1e18);
    vm.prank(user3);
    assertApproxEqAbs(orchestrator.collectRewards(), 40e18 + 866e17, 1e18);

    assertEq(orchestrator.claimableRewards(user1), 0);
    assertEq(orchestrator.claimableRewards(user2), 0);
    assertEq(orchestrator.claimableRewards(user3), 0);
  }

  function test_collectRewards_paused() public {
    vm.startPrank(pauser);
    orchestrator.pause();
    vm.stopPrank();

    vm.expectRevert(bytes("Pausable: paused"));
    orchestrator.collectRewards();
  }

  function test_scenario_offByOne() public {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS * 5);

    depositGFI(address(this), 5e18);
    depositStakedFidu(address(this), 6e18);

    skip(Epochs.EPOCH_SECONDS * 5);
    orchestrator.finalizeEpochs();

    usdc.transfer(reserveSplitter, 12e6);

    skip(Epochs.EPOCH_SECONDS);

    assertEq(orchestrator.collectRewards(), 6e18);
  }

  function test_scenario_finalizationBeforeStaking() public {
    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS * 5);
    orchestrator.finalizeEpochs();
    usdc.transfer(reserveSplitter, 12e6);

    skip(Epochs.EPOCH_SECONDS * 5);
    orchestrator.finalizeEpochs();

    skip(Epochs.EPOCH_SECONDS * 5);
    orchestrator.finalizeEpochs();
    usdc.transfer(reserveSplitter, 12e6);
  }

  function test_scenario_nonExistantPositionAfterLongNonInteraction() public {
    // Ensure there is no/minimal gas cost for no interactions over many epochs

    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);

    skip(Epochs.EPOCH_SECONDS * 5);

    depositGFI(address(1), 5e18);
    depositStakedFidu(address(1), 6e18);

    skip(Epochs.EPOCH_SECONDS * 500_000);

    depositGFI(address(2), 2e18);
  }

  function test_scenario_dontForfeitFirstEpochRewards() public {
    // Although rewards are collected, it's impossible for participants to get them for the
    // first epoch as no one can have eligible positions. Instead those rewards should be allocated
    // to a declared firstRewardEpoch.

    // Reset collector so we can set firstRewardEpoch
    {
      cake.router().setContract(
        Routing.Keys.MembershipCollector,
        address(new MembershipCollector(cake.context(), Epochs.next()))
      );

      address[] memory _payees = new address[](2);
      _payees[0] = governance;
      _payees[1] = cake.contractFor(Routing.Keys.MembershipCollector);

      uint256[] memory _shares = new uint256[](2);
      _shares[0] = 1;
      _shares[1] = 1;

      ERC20Splitter reserveSplitter = new ERC20Splitter(cake.context(), IERC20(address(usdc)));
      cake.accessControl().setAdmin(address(reserveSplitter), address(this));
      reserveSplitter.replacePayees(_payees, _shares);
      cake.accessControl().setAdmin(address(reserveSplitter), address(0));
      cake.router().setContract(Routing.Keys.ReserveSplitter, address(reserveSplitter));
    }

    address reserveSplitter = cake.contractFor(Routing.Keys.ReserveSplitter);
    MembershipCollector collector = MembershipCollector(cake.contractFor(Routing.Keys.MembershipCollector));

    usdc.transfer(reserveSplitter, 10e6);

    depositGFI(address(1), 5e18);
    depositStakedFidu(address(1), 6e18);

    usdc.transfer(reserveSplitter, 14e6);

    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    vm.prank(address(1));
    assertEq(orchestrator.collectRewards(), 0);

    assertEq(collector.rewardsForEpoch(Epochs.current() - 2), 0);
    assertEq(collector.rewardsForEpoch(Epochs.current() - 1), 0);
    assertEq(collector.rewardsForEpoch(Epochs.current()), 12e18);
    assertEq(collector.rewardsForEpoch(Epochs.current() + 1), 0);
    assertEq(collector.rewardsForEpoch(Epochs.current() + 2), 0);

    skip(Epochs.EPOCH_SECONDS);
    orchestrator.finalizeEpochs();

    vm.prank(address(1));
    assertEq(orchestrator.collectRewards(), 12e18);
  }

  function test_finalizeEpochs_paused() public {
    vm.startPrank(pauser);
    orchestrator.pause();
    vm.stopPrank();

    vm.expectRevert(bytes("Pausable: paused"));
    orchestrator.finalizeEpochs();
  }

  function test_calculateMemberScore() public {
    // 10^0.5 * 5^0.5 = 7.0710678119
    // Outcome in units 18

    assertEq(orchestrator.calculateMemberScore(10e18, 5e6), 7071067811865475247);
  }

  function test_totalMemberScores() public {
    (uint256 eligible, uint256 nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 0);
    assertEq(nextEpoch, 0);

    depositGFI(address(1), 10e18);

    (eligible, nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 0);
    assertEq(nextEpoch, 0);

    depositStakedFidu(address(1), 5e18);

    (eligible, nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 0);
    assertEq(nextEpoch, 7071067811865475247);

    skip(Epochs.EPOCH_SECONDS);

    (eligible, nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 7071067811865475247);
    assertEq(nextEpoch, 7071067811865475247);

    depositStakedFidu(address(1), 5e18);

    (eligible, nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 7071067811865475247);
    assertEq(nextEpoch, 10000000000000000000);

    skip(Epochs.EPOCH_SECONDS);

    (eligible, nextEpoch) = orchestrator.totalMemberScores();
    assertEq(eligible, 10000000000000000000);
    assertEq(nextEpoch, 10000000000000000000);
  }

  function test_estimateMemberScore_noExistingPosition() public {
    // no changes
    assertEq(orchestrator.estimateMemberScore(address(1), 0, 0), 0);

    // gfi changes
    assertEq(orchestrator.estimateMemberScore(address(1), 10e18, 0), 0);

    // capital changes
    assertEq(orchestrator.estimateMemberScore(address(1), 0, 10e18), 0);

    // gfi and capital changes

    // 10^0.5 * 5^0.5 = 7.0710678119
    // Outcome in units 18

    assertEq(orchestrator.estimateMemberScore(address(1), 10e18, 5e6), 7071067811865475247);

    vm.expectRevert(stdError.arithmeticError);
    orchestrator.estimateMemberScore(address(1), -1, 1);

    vm.expectRevert(stdError.arithmeticError);
    orchestrator.estimateMemberScore(address(1), 1, -1);

    vm.expectRevert(stdError.arithmeticError);
    orchestrator.estimateMemberScore(address(1), -1, -1);
  }

  function test_estimateMemberScore_existingPosition() public withGFIDeposit(10e18) withStakedFiduDeposit(5e18) {
    // no changes
    assertEq(orchestrator.estimateMemberScore(address(this), 0, 0), 7071067811865475247);

    // gfi changes
    assertEq(orchestrator.estimateMemberScore(address(this), 5e18, 0), 8660254037844386612); // 15^0.5 * 5^0.5 = 8.66
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, 0), 7416198487095663001); // 11^0.5 * 5^0.5 = 7.41
    assertEq(orchestrator.estimateMemberScore(address(this), -1e18, 0), 6708203932499369092); // 9^0.5 * 5^0.5 = 6.70
    assertEq(orchestrator.estimateMemberScore(address(this), -5e18, 0), 5000000000000000000); // 5^0.5 * 5^0.5 = 5
    assertEq(orchestrator.estimateMemberScore(address(this), -10e18, 0), 0); // 0^0.5 * 5^0.5 = 0

    // capital changes
    assertEq(orchestrator.estimateMemberScore(address(this), 0, 5e6), 10000000000000000000); // 10^0.5 * 10^0.5 = 10
    assertEq(orchestrator.estimateMemberScore(address(this), 0, 1e6), 7745966692414833774); // 10^0.5 * 6^0.5 = 7.74
    assertEq(orchestrator.estimateMemberScore(address(this), 0, -1e6), 6324555320336758708); // 10^0.5 * 4^0.5 = 6.32
    assertEq(orchestrator.estimateMemberScore(address(this), 0, -4e6), 3162277660168379474); // 10^0.5 * 1^0.5 = 3.16
    assertEq(orchestrator.estimateMemberScore(address(this), 0, -5e6), 0); // 10^0.5 * 0^0.5 = 0

    // gfi and capital changes

    // 15^0.5 * 10^0.5 = 12.24
    assertEq(orchestrator.estimateMemberScore(address(this), 5e18, 5e6), 12247448713915890571);
    // 15^0.5 * 6^0.5 = 9.48
    assertEq(orchestrator.estimateMemberScore(address(this), 5e18, 1e6), 9486832980505138063);
    // 11^0.5 * 10^0.5 = 10.48
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, 5e6), 10488088481701515469);
    // 11^0.5 * 6^0.5 = 8.12
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, 1e6), 8124038404635960361);
    // 9^0.5 * 6^0.5 = 7.34
    assertEq(orchestrator.estimateMemberScore(address(this), -1e18, 1e6), 7348469228349534342);
    // 5^0.5 * 6^0.5 = 5.47
    assertEq(orchestrator.estimateMemberScore(address(this), -5e18, 1e6), 5477225575051661134);
    // 11^0.5 * 4^0.5 = 6.63
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, -1e6), 6633249580710799810);
    // 11^0.5 * 1^0.5 = 3.31
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, -4e6), 3316624790355399998);
    // 6^0.5 * 4^0.5 = 4.89
    assertEq(orchestrator.estimateMemberScore(address(this), -4e18, -1e6), 4898979485566356228);
    // 9^0.5 * 1^0.5 = 3
    assertEq(orchestrator.estimateMemberScore(address(this), -1e18, -4e6), 3000000000000000115);
    // 6^0.5 * 1^0.5 = 2.44
    assertEq(orchestrator.estimateMemberScore(address(this), -4e18, -4e6), 2449489742783178156);
    // 11^0.5 * 0^0.5 = 0
    assertEq(orchestrator.estimateMemberScore(address(this), 1e18, -5e6), 0);
    // 5^0.5 * 4^0.5 = 4.47
    assertEq(orchestrator.estimateMemberScore(address(this), -5e18, -1e6), 4472135954999579392);
    // 0^0.5 * 1^0.5 = 0
    assertEq(orchestrator.estimateMemberScore(address(this), -10e18, -4e6), 0);
    // 0^0.5 * 0^0.5 = 0
    assertEq(orchestrator.estimateMemberScore(address(this), -10e18, -5e6), 0);
  }

  /// HELPERS

  function depositGFI(address addr, uint256 amount) private returns (uint256 id) {
    gfi.transfer(addr, amount);

    (uint256 previousEligible, uint256 previousTotal) = orchestrator.totalGFIHeldBy(addr);

    vm.startPrank(addr);
    gfi.approve(address(orchestrator), amount);
    id = orchestrator.deposit(Deposit({gfi: amount, capitalDeposits: new CapitalDeposit[](0)})).gfiPositionId;
    vm.stopPrank();

    (uint256 eligible, uint256 total) = orchestrator.totalGFIHeldBy(addr);
    assertEq(eligible, previousEligible);
    assertEq(total, previousTotal + amount);
  }

  function withdrawGFI(address addr, uint256 id) private {
    GFILedger ledger = GFILedger(cake.contractFor(Routing.Keys.GFILedger));
    (, , uint256 amount, ) = ledger.positions(id);
    withdrawGFI(addr, id, amount);
  }

  function withdrawGFI(
    address addr,
    uint256 id,
    uint256 amount
  ) private {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](1);
    gfiPositions[0] = ERC20Withdrawal({id: id, amount: amount});

    vm.prank(addr);
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: new uint256[](0)}));
  }

  function depositStakedFidu(address addr, uint256 balance) private returns (uint256 id) {
    (uint256 previousEligible, uint256 previousTotal) = orchestrator.totalCapitalHeldBy(addr);

    uint256 stakedFiduId = stakingRewards.mint(StakedPositionType.Fidu, balance);

    stakingRewards.safeTransferFrom(address(this), addr, stakedFiduId);

    vm.startPrank(addr);
    stakingRewards.approve(address(orchestrator), stakedFiduId);
    CapitalDeposit[] memory capitalDeposits = new CapitalDeposit[](1);
    capitalDeposits[0] = CapitalDeposit({assetAddress: address(stakingRewards), id: stakedFiduId});
    id = orchestrator.deposit(Deposit({gfi: 0, capitalDeposits: capitalDeposits})).capitalPositionIds[0];
    vm.stopPrank();

    (uint256 eligible, uint256 total) = orchestrator.totalCapitalHeldBy(addr);
    assertEq(eligible, previousEligible);
    assertEq(total, previousTotal + FiduConversions.fiduToUsdc(balance, 1e18));
  }

  function withdrawCapitalERC721(address addr, uint256 id) private {
    ERC20Withdrawal[] memory gfiPositions = new ERC20Withdrawal[](0);

    uint256[] memory capitalPositions = new uint256[](1);
    capitalPositions[0] = id;

    vm.prank(addr);
    orchestrator.withdraw(Withdrawal({gfiPositions: gfiPositions, capitalPositions: capitalPositions}));
  }

  function depositPoolToken(
    address addr,
    uint256 principle,
    uint256 principleRedeemed
  ) private {
    // todo
  }

  modifier withGFIDeposit(uint256 amount) {
    depositGFI(address(this), amount);
    _;
  }

  modifier withOtherGFIDeposit(address addr, uint256 amount) {
    depositGFI(addr, amount);
    _;
  }

  modifier withStakedFiduDeposit(uint256 balance) {
    depositStakedFidu(address(this), balance);
    _;
  }

  modifier withOtherStakedFiduDeposit(address addr, uint256 balance) {
    depositStakedFidu(addr, balance);
    _;
  }

  modifier withPoolTokenDeposit(
    address addr,
    uint256 principle,
    uint256 principleRedeemed
  ) {
    depositPoolToken(addr, principle, principleRedeemed);
    _;
  }

  // Required for testing erc721 transfers
  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  event RewardsClaimed(address indexed owner, uint256 rewards);
}

contract MockERC20 is ERC20Upgradeable {
  constructor(uint256 initialSupply) public {
    _mint(msg.sender, initialSupply);
  }
}

contract MockedStakingRewards is ERC721Upgradeable {
  struct Token {
    StakedPositionType positionType;
    uint256 balance;
  }

  Token[] public tokens;

  function init() external {
    Token memory token;
    tokens.push(token);
    __ERC721_init_unchained("Goldfinch V2 LP Staking Tokens", "GFI-V2-LPS");
  }

  function mint(StakedPositionType t, uint256 balance) external returns (uint256) {
    _safeMint(msg.sender, tokens.length);

    tokens.push(Token({positionType: t, balance: balance}));

    return tokens.length - 1;
  }

  function getPosition(uint256 tokenId) external view returns (StakedPosition memory position) {
    position.positionType = tokens[tokenId].positionType;
  }

  function stakedBalanceOf(uint256 tokenId) external view returns (uint256) {
    return tokens[tokenId].balance;
  }
}

contract MockedSeniorPool is Base {
  constructor(Context _context) Base(_context) {}

  function sharePrice() public pure returns (uint256) {
    return 1e18;
  }

  function deposit(uint256 usdcAmount) external returns (uint256) {
    require(usdcAmount > 0, "Must deposit more than zero");

    uint256 amount = FiduConversions.usdcToFidu(usdcAmount, sharePrice());

    context.fidu().transfer(msg.sender, amount);

    return amount;
  }
}
