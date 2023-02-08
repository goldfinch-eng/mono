// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
pragma solidity ^0.8.16;

import {MembershipCollector} from "../../../protocol/core/membership/MembershipCollector.sol";
import {ERC20Splitter} from "../../../protocol/core/membership/ERC20Splitter.sol";

import "openzeppelin-contracts-0-8-x/token/ERC20/IERC20.sol";
import {ERC20} from "openzeppelin-contracts-0-8-x/token/ERC20/ERC20.sol";
import {stdError} from "forge-std/Test.sol";

import {Base} from "../../../cake/Base.sol";
import {Context} from "../../../cake/Context.sol";
import {CakeHelper} from "../../cake/helpers/CakeHelper.t.sol";
import {BaseTest} from "../../core/BaseTest.t.sol";

import {ISeniorPool} from "../../../interfaces/ISeniorPool.sol";

import "../../../cake/Routing.sol" as Routing;

import {Epochs} from "../../../protocol/core/membership/Epochs.sol";
import {IAccessControl} from "../../../interfaces/IAccessControl.sol";

using Routing.Context for Context;

contract MockFidu is ERC20 {
  constructor() ERC20("FIDU", "FIDU") {}

  function mintTo(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

contract MockSeniorPool {
  Context context;
  MockFidu fidu;
  uint256 depositShares;
  uint256 numShares;

  constructor(Context _context, MockFidu _fidu) {
    context = _context;
    fidu = _fidu;
  }

  function mockDepositShares(uint256 _depositShares) external {
    depositShares = _depositShares;
  }

  function mockGetNumShares(uint256 _numShares) external {
    numShares = _numShares;
  }

  function deposit(uint256 usdcAmount) external returns (uint256) {
    context.usdc().transferFrom(msg.sender, address(this), usdcAmount);
    fidu.mintTo(msg.sender, depositShares);
    return depositShares;
  }

  function getNumShares(uint256) external view returns (uint256) {
    return numShares;
  }
}

contract MembershipCollectorTest is BaseTest {
  CakeHelper private cake;

  MembershipCollector membershipCollector;

  address reserveSplitterAddress;
  address someOtherAddress = address(999);

  MockFidu fidu;
  MockSeniorPool seniorPool;

  uint256 startingEpoch = 10;
  uint256 firstRewardEpoch = 5;

  function setUp() public override {
    super.setUp();
    cake = new CakeHelper(address(this));
    membershipCollector = new MembershipCollector(cake.context(), firstRewardEpoch);

    fidu = new MockFidu();
    seniorPool = new MockSeniorPool(cake.context(), fidu);

    address[] memory _payees = new address[](2);
    _payees[0] = address(1);
    _payees[1] = address(membershipCollector);

    uint256[] memory _shares = new uint256[](2);
    _shares[0] = 1;
    _shares[1] = 1;

    ERC20Splitter reserveSplitter = new ERC20Splitter(
      cake.context(),
      IERC20(address(protocol.usdc()))
    );
    cake.accessControl().setAdmin(address(reserveSplitter), address(this));
    reserveSplitter.replacePayees(_payees, _shares);
    reserveSplitterAddress = address(reserveSplitter);

    cake.router().setContract({key: Routing.Keys.ReserveSplitter, addr: reserveSplitterAddress});
    cake.router().setContract({key: Routing.Keys.USDC, addr: address(protocol.usdc())});
    cake.router().setContract({key: Routing.Keys.SeniorPool, addr: address(seniorPool)});
    cake.router().setContract({key: Routing.Keys.FIDU, addr: address(fidu)});

    // Warp ahead so that currentEpoch is not 0
    vm.warp(Epochs.EPOCH_SECONDS * startingEpoch);
  }

  function test_accessControl(address addr) public {
    vm.assume(addr != address(0));
    vm.assume(addr != address(this));

    // solhint-disable avoid-low-level-calls
    vm.startPrank(addr);

    vm.expectRevert(
      abi.encodeWithSelector(Base.RequiresOperator.selector, address(membershipCollector), addr)
    );
    membershipCollector.distributeFiduTo(address(1), 1);

    vm.stopPrank();
    // solhint-enable avoid-low-level-calls
  }

  function test_onReceive_allocatesAllToCurrentEpoch_whenLastFinalizedEpochIsNull()
    public
    impersonating(reserveSplitterAddress)
  {
    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 100_000e18;

    seniorPool.mockDepositShares(fiduAmount);

    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    assertEq(membershipCollector.rewardsForEpoch(Epochs.current()), fiduAmount);

    assertEq(fidu.balanceOf(address(membershipCollector)), fiduAmount);
    assertEq(protocol.usdc().balanceOf(address(membershipCollector)), 0);
  }

  function test_onReceive_allocatesProportionallyToElapsedUnfinalizedEpochs(
    uint256 elapsedEpochs
  ) public impersonating(reserveSplitterAddress) {
    vm.assume(elapsedEpochs < 20);

    // Initialize starting epoch
    membershipCollector.onReceive(0);

    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 100_000e18;

    seniorPool.mockDepositShares(fiduAmount);

    // Finalize starting epoch
    skip(Epochs.EPOCH_SECONDS);
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Let elapsedEpochs + 0.25 epochs elapse
    skip(Epochs.EPOCH_SECONDS * elapsedEpochs + Epochs.EPOCH_SECONDS / 4);

    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    assertEq(fidu.balanceOf(address(membershipCollector)), fiduAmount * 2);
    assertEq(protocol.usdc().balanceOf(address(membershipCollector)), 0);

    // Epoch 1 should receive all of the first distribution
    assertEq(membershipCollector.rewardsForEpoch(startingEpoch), fiduAmount);

    // Elapsed epochs should receive 1 / (elapsedEpochs + 0.25) of second distribution
    for (uint256 i = 1; i <= elapsedEpochs; i++) {
      assertApproxEqAbs(
        membershipCollector.rewardsForEpoch(startingEpoch + i),
        (fiduAmount * Epochs.EPOCH_SECONDS) /
          (Epochs.EPOCH_SECONDS * elapsedEpochs + Epochs.EPOCH_SECONDS / 4),
        1e18
      );
    }

    // Current epoch should receive 0.25 / (elapsedEpochs + 0.25) of second distribution
    assertApproxEqAbs(
      membershipCollector.rewardsForEpoch(Epochs.current()),
      ((fiduAmount * Epochs.EPOCH_SECONDS) / 4) /
        (Epochs.EPOCH_SECONDS * elapsedEpochs + Epochs.EPOCH_SECONDS / 4),
      1e18
    );

    // lastFinalizedEpoch should be checkpointed to the prior epoch
    assertEq(membershipCollector.lastFinalizedEpoch(), Epochs.current() - 1);
  }

  function test_onReceive_allocatesProportionallyToPartiallyCheckpointedEpoch()
    public
    impersonating(reserveSplitterAddress)
  {
    // Initialize starting epoch
    membershipCollector.onReceive(0);

    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 100_000e18;

    seniorPool.mockDepositShares(fiduAmount);

    // Skip forward half an epoch and checkpoint
    skip(Epochs.EPOCH_SECONDS / 2);
    membershipCollector.onReceive(0);

    // Skip forward a full epoch. We are now halfway through the second epoch.
    skip(Epochs.EPOCH_SECONDS);

    // Allocate rewards
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Epoch 1 should receive half of the reward distribution since it was checkpointed halfway through
    assertApproxEqAbs(membershipCollector.rewardsForEpoch(startingEpoch), fiduAmount / 2, 1e18);

    // Epoch 2 should receive half of the reward distribution since it is halfway through
    assertApproxEqAbs(membershipCollector.rewardsForEpoch(startingEpoch + 1), fiduAmount / 2, 1e18);
  }

  function test_onReceive_revertsForNonReserveSplitterAddress()
    public
    impersonating(someOtherAddress)
  {
    vm.expectRevert(abi.encodeWithSelector(MembershipCollector.InvalidReceiveCaller.selector));
    membershipCollector.onReceive(100e6);
  }

  function test_onReceive_allocatesToFirstRewardEpoch()
    public
    impersonating(reserveSplitterAddress)
  {
    firstRewardEpoch = startingEpoch + 5;

    // Custom collector so we can set firstRewardEpoch
    membershipCollector = new MembershipCollector(cake.context(), firstRewardEpoch);

    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 100_000e18;

    seniorPool.mockDepositShares(fiduAmount);

    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Before the first reward epoch, so reward should go to first reward epoch
    assertEq(membershipCollector.rewardsForEpoch(Epochs.current()), 0);
    assertEq(membershipCollector.rewardsForEpoch(firstRewardEpoch), fiduAmount);

    // +1 epoch
    skip(Epochs.EPOCH_SECONDS);

    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Still before the first reward epoch, so reward should go to first reward epoch
    assertEq(membershipCollector.rewardsForEpoch(Epochs.current()), 0);
    assertEq(membershipCollector.rewardsForEpoch(firstRewardEpoch), fiduAmount * 2);

    // +7 epoch, 2 past firstRewardEpoch, so amount will be split between first reward epoch
    // and the subsequent epoch
    skip(Epochs.EPOCH_SECONDS * 6);

    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    assertEq(
      membershipCollector.rewardsForEpoch(firstRewardEpoch),
      fiduAmount * 2 + fiduAmount / 2
    );
    assertEq(membershipCollector.rewardsForEpoch(Epochs.current() - 1), fiduAmount / 2);
  }

  function test_estimateRewardsFor() public impersonating(reserveSplitterAddress) {
    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 90_000e18;
    seniorPool.mockDepositShares(fiduAmount);

    uint256 pendingDistributionAmountUsdc = usdcAmount * 3;
    uint256 pendingDistributionAmountFidu = fiduAmount * 3;
    seniorPool.mockGetNumShares(pendingDistributionAmountFidu);

    // Initialize starting epoch
    membershipCollector.onReceive(0);

    skip(Epochs.EPOCH_SECONDS);

    // Finalize previous - 2
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    skip(Epochs.EPOCH_SECONDS);

    // Finalize previous - 1
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    skip(Epochs.EPOCH_SECONDS + Epochs.EPOCH_SECONDS / 2);

    fundAddress(reserveSplitterAddress, pendingDistributionAmountUsdc * 2);

    /// Already finalized
    assertEq(membershipCollector.estimateRewardsFor(Epochs.previous() - 2), fiduAmount);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.previous() - 1), fiduAmount);

    // Pending finalization
    // 2/3 of pendingDistributionAmountFidu because the previous epoch accounts for 1 / 1.5 epoch time
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.previous()),
      (pendingDistributionAmountFidu * 2) / 3
    );

    // Current
    // 1/3 of pendingDistributionAmountFidu because the current epoch accounts for 0.5 / 1.5 epoch time
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.current()),
      pendingDistributionAmountFidu / 3
    );

    // Finalize previous
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Current and none pending finalization
    // fiduAmount / 3 because the onRecieve above distributed fiduAmount pro-rata across 1.5 epochs
    // usdcAmount * 3 because reserveSplitterAddress still has usdcAmount * 6 in it
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.current()),
      fiduAmount / 3 + pendingDistributionAmountFidu
    );

    // Future
    assertEq(membershipCollector.estimateRewardsFor(Epochs.next()), 0);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.next() + 1), 0);
  }

  function test_estimateRewardsFor_partiallyCheckpointedEpoch()
    public
    impersonating(reserveSplitterAddress)
  {
    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 100_000e18;
    seniorPool.mockDepositShares(fiduAmount);

    uint256 pendingDistributionAmountFidu = fiduAmount;
    seniorPool.mockGetNumShares(pendingDistributionAmountFidu);

    // Initialize starting epoch
    membershipCollector.onReceive(0);

    // Skip forward half an epoch and checkpoint
    skip(Epochs.EPOCH_SECONDS / 2);
    membershipCollector.onReceive(0);

    // Skip forward a full epoch. We are now halfway through the second epoch.
    skip(Epochs.EPOCH_SECONDS);

    // Allocate protocol reserves
    fundAddress(reserveSplitterAddress, usdcAmount * 2);

    // Epoch 1 estimate should have half of the reward distribution since it was checkpointed halfway through
    assertApproxEqAbs(
      membershipCollector.estimateRewardsFor(startingEpoch),
      pendingDistributionAmountFidu / 2,
      1e18
    );

    // Epoch 2 estimate should have half of the reward distribution since it is halfway through
    assertApproxEqAbs(
      membershipCollector.estimateRewardsFor(startingEpoch + 1),
      pendingDistributionAmountFidu / 2,
      1e18
    );
  }

  function test_estimateRewardsFor_firstRewardEpoch() public impersonating(reserveSplitterAddress) {
    // Warp back so we're before firstRewardEpoch
    vm.warp(Epochs.EPOCH_SECONDS * (firstRewardEpoch - 3));

    uint256 usdcAmount = 110_000e6;
    uint256 fiduAmount = 90_000e18;
    seniorPool.mockDepositShares(fiduAmount);

    uint256 pendingDistributionAmountUsdc = usdcAmount * 3;
    uint256 pendingDistributionAmountFidu = fiduAmount * 3;
    seniorPool.mockGetNumShares(pendingDistributionAmountFidu);

    vm.expectEmit(true, false, false, true);
    emit EpochFinalized(firstRewardEpoch - 1, 0);

    // Initialize starting epoch
    membershipCollector.onReceive(0);

    skip(Epochs.EPOCH_SECONDS); // firstRewardEpoch - 2

    // Finalize firstRewardEpoch - 3
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    skip(Epochs.EPOCH_SECONDS); // firstRewardEpoch - 1

    // Finalize firstRewardEpoch - 2
    fundAddress(address(membershipCollector), usdcAmount);
    membershipCollector.onReceive(usdcAmount);

    // Now halfway through firstRewardEpoch
    skip(Epochs.EPOCH_SECONDS + Epochs.EPOCH_SECONDS / 2); // firstRewardEpoch + 1/2

    fundAddress(reserveSplitterAddress, pendingDistributionAmountUsdc * 2);

    /// Before first reward epoch
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 3), 0);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 2), 0);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 1), 0);

    // First reward epoch
    // Collects the deposits from previous epochs and includes 50% of reserveSplitterAddress
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.current()),
      fiduAmount * 2 + pendingDistributionAmountFidu
    );

    // Now halfway through epoch after firstRewardEpoch
    skip(Epochs.EPOCH_SECONDS); // firstRewardEpoch + 1 1/2

    /// Before first reward epoch
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 4), 0);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 3), 0);
    assertEq(membershipCollector.estimateRewardsFor(Epochs.current() - 2), 0);

    // First reward epoch
    // fiduAmount is allocated from previous finalized epochs and pending fidu distribution is split 2/3 to
    // this and 1/3 to the half-finished epoch after this
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.previous()),
      fiduAmount * 2 + (pendingDistributionAmountFidu * 2) / 3
    );

    // Epoch after first reward epoch
    // Collects the deposits from previous epochs and includes 50% of reserveSplitterAddress
    assertEq(
      membershipCollector.estimateRewardsFor(Epochs.current()),
      pendingDistributionAmountFidu / 3
    );
  }

  event EpochFinalized(uint256 indexed epoch, uint256 totalRewards);
}
