// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Accountant} from "../../protocol/core/Accountant.sol";
import {BackerRewards} from "../../rewards/BackerRewards.sol";
import {BaseTest} from "./BaseTest.t.sol";
import {ConfigHelper} from "../../protocol/core/ConfigHelper.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import {CreditLine} from "../../protocol/core/CreditLine.sol";
import {DepositWithPermitHelpers} from "../helpers/DepositWithPermitHelpers.t.sol";
import {Fidu} from "../../protocol/core/Fidu.sol";
import {FixedLeverageRatioStrategy} from "../../protocol/core/FixedLeverageRatioStrategy.sol";
import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {Go} from "../../protocol/core/Go.sol";
import {ISeniorPoolEpochWithdrawals} from "../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {IERC20WithName} from "../../interfaces/IERC20WithName.sol";
import {ITestUniqueIdentity0612} from "../../test/ITestUniqueIdentity0612.t.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";
import {LeverageRatioStrategy} from "../../protocol/core/LeverageRatioStrategy.sol";
import {Schedule} from "../../protocol/core/schedule/Schedule.sol";
import {PoolTokens} from "../../protocol/core/PoolTokens.sol";
import {StakingRewards} from "../../rewards/StakingRewards.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {TestERC20} from "../../test/TestERC20.sol";
import {TestSeniorPool} from "../../test/TestSeniorPool.sol";
import {TestTranchedPool} from "../TestTranchedPool.sol";
import {TranchedPoolBuilder} from "../helpers/TranchedPoolBuilder.t.sol";
import {TranchedPoolImplementationRepository} from "../../protocol/core/TranchedPoolImplementationRepository.sol";
import {TranchingLogic} from "../../protocol/core/TranchingLogic.sol";
import {WithdrawalRequestToken} from "../../protocol/core/WithdrawalRequestToken.sol";
import {MonthlyScheduleRepo} from "../../protocol/core/schedule/MonthlyScheduleRepo.sol";

contract SeniorPoolBaseTest is BaseTest {
  using ConfigHelper for GoldfinchConfig;

  uint256 internal constant LEVERAGE_RATIO = 4000000000000000000; // 4x
  uint256 internal constant TP_DRAWDOWN_PERIOD = 7 days;

  TestSeniorPool internal sp;
  LeverageRatioStrategy internal strat;
  Go internal go;
  ITestUniqueIdentity0612 internal uniqueIdentity;
  WithdrawalRequestToken internal requestTokens;
  TranchedPoolBuilder internal tpBuilder;
  PoolTokens internal poolTokens;
  Fidu internal fidu;
  TestERC20 internal usdc;
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;

  function setUp() public override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    // GoldfinchConfig setup
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    // GoldfinchFactory setup
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));

    // USDC setup
    usdc = TestERC20(address(protocol.usdc()));

    // FIDU setup
    fidu = Fidu(address(protocol.fidu()));

    // SeniorPool setup
    sp = new TestSeniorPool();
    sp.initialize(GF_OWNER, gfConfig);
    sp.initializeEpochs();
    fidu.grantRole(TestConstants.MINTER_ROLE, address(sp));
    FixedLeverageRatioStrategy _strat = new FixedLeverageRatioStrategy();
    _strat.initialize(GF_OWNER, gfConfig);
    strat = _strat;
    approveTokensMaxAmount(GF_OWNER);

    // WithdrawalRequestToken setup
    requestTokens = new WithdrawalRequestToken();
    requestTokens.__initialize__(GF_OWNER, gfConfig);

    // UniqueIdentity setup
    uniqueIdentity = ITestUniqueIdentity0612(deployCode("TestUniqueIdentity.sol"));
    uniqueIdentity.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uniqueIdentity.setSupportedUIDTypes(supportedUids, supportedUidValues);

    // TranchedPool and CreditLine setup
    TestTranchedPool tpImpl = new TestTranchedPool();
    TranchedPoolImplementationRepository tpImplRepo = new TranchedPoolImplementationRepository();
    tpImplRepo.initialize(GF_OWNER, address(tpImpl));

    CreditLine clImpl = new CreditLine();

    // MonthlyScheduleRepository setup
    MonthlyScheduleRepo monthlyScheduleRepo = new MonthlyScheduleRepo();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.MonthlyScheduleRepo),
      address(monthlyScheduleRepo)
    );
    fuzzHelper.exclude(address(monthlyScheduleRepo));
    fuzzHelper.exclude(address(monthlyScheduleRepo.periodMapper()));

    tpBuilder = new TranchedPoolBuilder(gfFactory, sp, monthlyScheduleRepo);
    gfFactory.grantRole(gfFactory.OWNER_ROLE(), address(tpBuilder)); // Allows the builder to create pools

    // PoolTokens setup
    poolTokens = new PoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);

    // BackerRewards setup
    BackerRewards backerRewards = new BackerRewards();
    backerRewards.__initialize__(GF_OWNER, gfConfig);

    // Go setup
    go = new Go();
    go.initialize(GF_OWNER, gfConfig, address(uniqueIdentity));

    // ConfigSetup
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPool), address(sp));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy), address(strat));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.WithdrawalRequestToken),
      address(requestTokens)
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(tpImplRepo)
    );
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation), address(clImpl));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.BackerRewards), address(backerRewards));
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LeverageRatio), LEVERAGE_RATIO);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds), TP_DRAWDOWN_PERIOD);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.SeniorPoolWithdrawalCancelationFeeInBps), 10);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.WithdrawFeeDenominator), 200);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.ReserveDenominator), 10);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays), 30);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessMaxDays), 120);

    gfConfig.addToGoList(GF_OWNER);
    gfConfig.addToGoList(address(sp));

    // Exclude known addresses from fuzzed inputs. This prevents flakey errors like
    // "Error sent ERC1155 to non-receiver"
    fuzzHelper.exclude(address(0));
    fuzzHelper.exclude(gfConfig.protocolAdminAddress());
    fuzzHelper.exclude(address(sp));
    fuzzHelper.exclude(address(strat));
    fuzzHelper.exclude(address(go));
    fuzzHelper.exclude(address(requestTokens));
    fuzzHelper.exclude(address(tpImpl));
    fuzzHelper.exclude(address(tpImplRepo));
    fuzzHelper.exclude(address(clImpl));
    fuzzHelper.exclude(address(tpBuilder));
    fuzzHelper.exclude(address(poolTokens));
    fuzzHelper.exclude(address(TranchingLogic));
    fuzzHelper.exclude(address(Accountant));
    fuzzHelper.exclude(address(protocol.stakingRewards()));
    fuzzHelper.exclude(address(backerRewards));
    fuzzHelper.exclude(address(uniqueIdentity));

    _stopImpersonation();
  }

  function withdrawalAmountLessFees(uint256 usdcAmount) internal view returns (uint256) {
    return usdcAmount - withdrawalFee(usdcAmount);
  }

  function withdrawalFee(uint256 usdcAmount) internal view returns (uint256) {
    return usdcAmount / gfConfig.getWithdrawFeeDenominator();
  }

  function cancelationFee(uint256 fiduAmount) internal view returns (uint256) {
    return (fiduAmount * gfConfig.getSeniorPoolWithdrawalCancelationFeeInBps()) / 10_000;
  }

  function defaultTp() internal impersonating(GF_OWNER) returns (TestTranchedPool, CreditLine) {
    (TestTranchedPool tp, CreditLine cl) = tpBuilder.build(GF_OWNER);
    fuzzHelper.exclude(address(tp));
    fuzzHelper.exclude(address(tp.creditLine()));
    (ISchedule schedule, ) = cl.schedule();
    fuzzHelper.exclude(address(schedule));
    tp.grantRole(tp.SENIOR_ROLE(), address(sp));
    return (tp, cl);
  }

  function depositToTpFrom(
    address user,
    uint256 amount,
    TestTranchedPool tp
  ) internal impersonating(user) returns (uint256) {
    usdc.approve(address(tp), amount);
    return tp.deposit(uint256(ITranchedPool.Tranches.Junior), amount);
  }

  function payTp(uint256 amount, TestTranchedPool tp) internal impersonating(GF_OWNER) {
    usdc.approve(address(tp), type(uint256).max);
    tp.pay(amount);
  }

  function drawdownTp(
    uint256 amount,
    TestTranchedPool tp
  ) internal impersonating(tp.creditLine().borrower()) {
    tp.drawdown(amount);
  }

  function lockJuniorCap(TestTranchedPool tp) internal impersonating(tp.creditLine().borrower()) {
    tp.lockJuniorCapital();
  }

  function lock(TestTranchedPool tp) internal impersonating(tp.creditLine().borrower()) {
    tp.lockPool();
  }

  function depositToSpFrom(
    address user,
    uint256 amount
  ) internal impersonating(user) returns (uint256) {
    return sp.deposit(amount);
  }

  function requestWithdrawalFrom(
    address user,
    uint256 fiduAmount
  ) internal impersonating(user) returns (uint256) {
    return sp.requestWithdrawal(fiduAmount);
  }

  function cancelWithdrawalRequestFrom(
    address user,
    uint256 tokenId
  ) internal impersonating(user) returns (uint256) {
    return sp.cancelWithdrawalRequest(tokenId);
  }

  function claimWithdrawalRequestFrom(
    address user,
    uint256 tokenId
  ) internal impersonating(user) returns (uint256) {
    return sp.claimWithdrawalRequest(tokenId);
  }

  function addToWithdrawalRequestFrom(
    address user,
    uint256 fiduAmount,
    uint256 tokenId
  ) internal impersonating(user) {
    sp.addToWithdrawalRequest(fiduAmount, tokenId);
  }

  function withdrawFrom(address user, uint256 amount) internal impersonating(user) {
    sp.withdraw(amount);
  }

  function withdrawInFiduFrom(address user, uint256 fiduAmount) internal impersonating(user) {
    sp.withdrawInFidu(fiduAmount);
  }

  function addToGoList(address user) internal impersonating(GF_OWNER) {
    gfConfig.addToGoList(user);
  }

  function removeFromGoList(address user) internal impersonating(GF_OWNER) {
    gfConfig.removeFromGoList(user);
  }

  function approveTokensMaxAmount(address user) internal impersonating(user) {
    usdc.approve(address(sp), type(uint256).max);
    fidu.approve(address(sp), type(uint256).max);
  }

  function burnUid(address account, uint256 id) internal impersonating(GF_OWNER) {
    uniqueIdentity._burnForTest(account, id);
  }

  function transferFidu(address from, address to, uint256 amount) internal impersonating(from) {
    fidu.transfer(to, amount);
  }

  function approveForAll(address from, address to, bool approval) internal impersonating(from) {
    uniqueIdentity.setApprovalForAll(to, approval);
  }

  function getSignature(
    address user,
    uint256 userPrivateKey,
    uint256 amount
  ) internal returns (uint8, bytes32, bytes32) {
    uint256 nonce = usdc.nonces(user);
    uint256 deadline = type(uint256).max;
    // Get signature for permit
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(usdc)),
      user,
      address(sp),
      amount,
      nonce,
      deadline
    );
    return vm.sign(userPrivateKey, digest);
  }

  modifier goListed(address user) {
    addToGoList(user);
    _;
  }

  modifier paused() {
    _startImpersonation(GF_OWNER);
    sp.pause();
    _stopImpersonation();
    _;
  }

  modifier tokenApproved(address user) {
    approveTokensMaxAmount(user);
    _;
  }

  modifier withRole(address user, bytes32 role) {
    grantRole(address(sp), role, user);
    _;
  }

  // So we can mint UIDs to the test class
  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes calldata
  ) external returns (bytes4) {
    return 0xf23a6e61;
  }

  event DepositMade(address indexed capitalProvider, uint256 amount, uint256 shares);
  event WithdrawalMade(address indexed capitalProvider, uint256 userAmount, uint256 reserveAmount);
  event WithdrawalRequested(
    uint256 indexed epochId,
    uint256 indexed tokenId,
    address indexed operator,
    uint256 fiduRequested
  );
  event WithdrawalCanceled(
    uint256 indexed epochId,
    uint256 indexed tokenId,
    address indexed operator,
    uint256 fiduCanceled,
    uint256 reserveFidu
  );
  event WithdrawalAddedTo(
    uint256 indexed epochId,
    uint256 indexed tokenId,
    address indexed operator,
    uint256 fiduRequested
  );
  event ReserveSharesCollected(address indexed user, address indexed reserve, uint256 amount);
  event InvestmentMadeInSenior(address indexed tranchedPool, uint256 amount);
  event EpochDurationChanged(uint256 newDuration);
  event InterestCollected(address indexed payer, uint256 amount);
  event PrincipalCollected(address indexed payer, uint256 amount);
  event PrincipalWrittenDown(address indexed tranchedPool, int256 amount);
  event EpochExtended(uint256 indexed epochId, uint256 newEndTime, uint256 oldEndTime);
  event EpochEnded(
    uint256 indexed epochId,
    uint256 endTime,
    uint256 fiduRequested,
    uint256 usdcAllocated,
    uint256 fiduLiquidated
  );
}
