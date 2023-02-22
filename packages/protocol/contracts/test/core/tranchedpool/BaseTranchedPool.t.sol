// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {TranchingLogic} from "../../../protocol/core/TranchingLogic.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {GoldfinchFactory} from "../../../protocol/core/GoldfinchFactory.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {SeniorPool} from "../../../protocol/core/SeniorPool.sol";
import {Fidu} from "../../../protocol/core/Fidu.sol";
import {LeverageRatioStrategy} from "../../../protocol/core/LeverageRatioStrategy.sol";
import {FixedLeverageRatioStrategy} from "../../../protocol/core/FixedLeverageRatioStrategy.sol";
import {WithdrawalRequestToken} from "../../../protocol/core/WithdrawalRequestToken.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";
import {BackerRewards} from "../../../rewards/BackerRewards.sol";
import {Go} from "../../../protocol/core/Go.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {TranchedPoolImplementationRepository} from "../../../protocol/core/TranchedPoolImplementationRepository.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {MonthlyScheduleRepo} from "../../../protocol/core/schedule/MonthlyScheduleRepo.sol";

import {TranchedPoolBuilder} from "../../helpers/TranchedPoolBuilder.t.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {TestERC20} from "../../TestERC20.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {ITestUniqueIdentity0612} from "../../ITestUniqueIdentity0612.t.sol";

contract TranchedPoolBaseTest is BaseTest {
  address public constant BORROWER = 0x228994aE78d75939A5aB9260a83bEEacBE77Ddd0; // random address
  address public constant DEPOSITOR = 0x89b8CbAeBd6C623a69a4DEBe9EE03131b5F4Ff96; // random address

  uint256 internal constant UNIT_SHARE_PRICE = 1e18;
  uint256 internal constant DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS = 7 days;
  uint256 internal constant HALF_CENT = 1e6 / 200;

  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;
  TestERC20 internal usdc;
  Fidu internal fidu;
  SeniorPool internal seniorPool;
  LeverageRatioStrategy internal strat;
  WithdrawalRequestToken internal requestTokens;
  ITestUniqueIdentity0612 internal uid;
  TranchedPoolBuilder internal poolBuilder;
  PoolTokens internal poolTokens;
  Go internal go;

  function setUp() public virtual override {
    super.setUp();

    _startImpersonation(GF_OWNER);

    // GoldfinchConfig setup
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    // Setup gfFactory
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));

    // USDC setup
    usdc = TestERC20(address(protocol.usdc()));

    // FIDU setup
    fidu = Fidu(address(protocol.fidu()));

    // SeniorPool setup
    seniorPool = new SeniorPool();
    seniorPool.initialize(GF_OWNER, gfConfig);
    seniorPool.initializeEpochs();
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPool), address(seniorPool));
    fuzzHelper.exclude(address(seniorPool));

    fidu.grantRole(TestConstants.MINTER_ROLE, address(seniorPool));
    FixedLeverageRatioStrategy _strat = new FixedLeverageRatioStrategy();
    _strat.initialize(GF_OWNER, gfConfig);
    strat = _strat;
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy), address(strat));
    fuzzHelper.exclude(address(strat));

    approveTokensMaxAmount(GF_OWNER);

    // WithdrawalRequestToken setup
    requestTokens = new WithdrawalRequestToken();
    requestTokens.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.WithdrawalRequestToken),
      address(requestTokens)
    );
    fuzzHelper.exclude(address(requestTokens));

    // UniqueIdentity setup
    uid = ITestUniqueIdentity0612(deployCode("TestUniqueIdentity.sol"));
    uid.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);
    fuzzHelper.exclude(address(uid));

    // PoolTokens setup
    poolTokens = new PoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));
    fuzzHelper.exclude(address(poolTokens));

    // BackerRewards setup
    BackerRewards backerRewards = new BackerRewards();
    backerRewards.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.BackerRewards), address(backerRewards));
    fuzzHelper.exclude(address(backerRewards));

    // Go setup
    go = new Go();
    go.initialize(GF_OWNER, gfConfig, address(uid));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));
    fuzzHelper.exclude(address(go));

    // TranchedPool setup
    TranchedPool tranchedPoolImpl = new TranchedPool();
    TranchedPoolImplementationRepository tranchedPoolRepo = new TranchedPoolImplementationRepository();
    tranchedPoolRepo.initialize(GF_OWNER, address(tranchedPoolImpl));
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(tranchedPoolRepo)
    );
    fuzzHelper.exclude(address(tranchedPoolImpl));
    fuzzHelper.exclude(address(tranchedPoolRepo));

    // CreditLine setup
    CreditLine creditLineImpl = new CreditLine();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CreditLineImplementation),
      address(creditLineImpl)
    );
    fuzzHelper.exclude(address(creditLineImpl));

    // MonthlyScheduleRepository setup
    MonthlyScheduleRepo monthlyScheduleRepo = new MonthlyScheduleRepo();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.MonthlyScheduleRepo),
      address(monthlyScheduleRepo)
    );
    fuzzHelper.exclude(address(monthlyScheduleRepo));
    fuzzHelper.exclude(address(monthlyScheduleRepo.periodMapper()));

    poolBuilder = new TranchedPoolBuilder(gfFactory, seniorPool, monthlyScheduleRepo);
    fuzzHelper.exclude(address(poolBuilder));
    // Allow the builder to create pools
    gfFactory.grantRole(gfFactory.OWNER_ROLE(), address(poolBuilder));

    // Other config numbers
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.ReserveDenominator), 10); // 0.1%
    gfConfig.setNumber(
      uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds),
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LeverageRatio), 4000000000000000000); // 4x leverage

    // Other stuff
    addToGoList(GF_OWNER);
    addToGoList(address(seniorPool));

    fuzzHelper.exclude(BORROWER);
    fuzzHelper.exclude(DEPOSITOR);
    fuzzHelper.exclude(address(TranchingLogic));
    fuzzHelper.exclude(address(Accountant));
    fuzzHelper.exclude(address(this));

    // Fund the depositor
    usdc.transfer(DEPOSITOR, usdcVal(1_000_000_000));

    _stopImpersonation();
  }

  function tranchedPoolWithMonthlyPrincipalSchedule()
    internal
    impersonating(GF_OWNER)
    returns (TranchedPool, CreditLine)
  {
    (TranchedPool pool, CreditLine cl) = poolBuilder.buildWithMonthlySchedule({
      borrower: BORROWER,
      monthsInTerm: 12,
      monthsPerInterestPeriod: 1,
      monthsPerPrincipalPeriod: 1
    });
    fuzzHelper.exclude(address(pool));
    fuzzHelper.exclude(address(cl));
    (ISchedule schedule, ) = cl.schedule();
    fuzzHelper.exclude(address(schedule));
    pool.grantRole(pool.SENIOR_ROLE(), address(seniorPool));
    return (pool, cl);
  }

  function defaultTranchedPool()
    internal
    impersonating(GF_OWNER)
    returns (TranchedPool, CreditLine)
  {
    (TranchedPool pool, CreditLine cl) = poolBuilder.build(BORROWER);
    fuzzHelper.exclude(address(pool));
    fuzzHelper.exclude(address(cl));
    (ISchedule schedule, ) = cl.schedule();
    fuzzHelper.exclude(address(schedule));
    pool.grantRole(pool.SENIOR_ROLE(), address(seniorPool));
    return (pool, cl);
  }

  function tranchedPoolWithLateFees(
    uint256 lateFeeApr,
    uint256 lateFeeGracePeriodInDays
  ) public impersonating(GF_OWNER) returns (TranchedPool, CreditLine) {
    (TranchedPool pool, CreditLine cl) = poolBuilder.withLateFeeApr(lateFeeApr).build(BORROWER);
    fuzzHelper.exclude(address(pool));
    fuzzHelper.exclude(address(cl));
    pool.grantRole(pool.SENIOR_ROLE(), address(seniorPool));
    gfConfig.setNumber(
      uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays),
      lateFeeGracePeriodInDays
    );
    return (pool, cl);
  }

  function approveTokensMaxAmount(address user) internal impersonating(user) {
    usdc.approve(address(seniorPool), type(uint256).max);
    fidu.approve(address(seniorPool), type(uint256).max);
  }

  function seniorDepositAndInvest(
    TranchedPool pool,
    uint256 amount
  ) internal impersonating(GF_OWNER) returns (uint256) {
    seniorPool.deposit(amount);
    return seniorPool.invest(ITranchedPool(address(pool)));
  }

  function deposit(
    TranchedPool pool,
    uint256 tranche,
    uint256 depositAmount,
    address depositor
  ) internal impersonating(depositor) returns (uint256) {
    uint256 balance = usdc.balanceOf(depositor);
    if (balance < depositAmount) {
      fundAddress(depositor, depositAmount - balance);
    }
    usdc.approve(address(pool), depositAmount);
    return pool.deposit(tranche, depositAmount);
  }

  function lockJuniorTranche(
    TranchedPool pool
  ) internal impersonating(pool.creditLine().borrower()) {
    pool.lockJuniorCapital();
  }

  function lockSeniorTranche(
    TranchedPool pool
  ) internal impersonating(pool.creditLine().borrower()) {
    pool.lockPool();
  }

  function lockAndDrawdown(
    TranchedPool pool,
    uint256 amount
  ) internal impersonating(pool.creditLine().borrower()) {
    pool.lockJuniorCapital();
    pool.lockPool();
    pool.drawdown(amount);
  }

  function pay(
    TranchedPool pool,
    uint256 amount
  ) internal impersonating(pool.creditLine().borrower()) {
    usdc.approve(address(pool), amount);
    uint256 balance = usdc.balanceOf(pool.creditLine().borrower());
    if (balance < amount) {
      fundAddress(pool.creditLine().borrower(), amount - balance);
    }
    pool.pay(amount);
  }

  function pay(
    TranchedPool pool,
    uint256 principal,
    uint256 interest
  ) internal impersonating(pool.creditLine().borrower()) {
    uint256 amount = interest + principal;
    usdc.approve(address(pool), amount);
    uint256 balance = usdc.balanceOf(pool.creditLine().borrower());
    if (balance < amount) {
      fundAddress(pool.creditLine().borrower(), amount - balance);
    }
    pool.pay(principal, interest);
  }

  function withdraw(
    TranchedPool pool,
    uint256 token,
    uint256 amount,
    address withdrawer
  ) internal impersonating(withdrawer) returns (uint256, uint256) {
    return pool.withdraw(token, amount);
  }

  function withdrawMax(
    TranchedPool pool,
    uint256 token,
    address withdrawer
  ) internal impersonating(withdrawer) returns (uint256, uint256) {
    return pool.withdrawMax(token);
  }

  function withdrawMultiple(
    TranchedPool pool,
    uint256[] memory tokens,
    uint256[] memory amounts,
    address withdrawer
  ) internal impersonating(withdrawer) {
    pool.withdrawMultiple(tokens, amounts);
  }

  function drawdown(
    TranchedPool pool,
    uint256 amount
  ) internal impersonating(pool.creditLine().borrower()) {
    pool.drawdown(amount);
  }

  function setLimit(TranchedPool pool, uint256 limit) internal impersonating(GF_OWNER) {
    pool.setLimit(limit);
  }

  function setMaxLimit(TranchedPool pool, uint256 maxLimit) internal impersonating(GF_OWNER) {
    pool.setMaxLimit(maxLimit);
  }

  function pause(TranchedPool pool) internal impersonating(GF_OWNER) {
    pool.pause();
  }

  function unpause(TranchedPool pool) internal impersonating(GF_OWNER) {
    pool.unpause();
  }

  function depositWithPermit(
    TranchedPool pool,
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s,
    address user
  ) internal impersonating(user) returns (uint256) {
    uint256 balance = usdc.balanceOf(user);
    if (balance < amount) {
      fundAddress(user, amount - balance);
    }
    return pool.depositWithPermit(tranche, amount, deadline, v, r, s);
  }

  function fundAndDrawdown(
    TranchedPool pool,
    uint256 juniorAmount,
    address juniorInvestor
  ) internal impersonating(pool.creditLine().borrower()) {
    deposit(pool, 2, juniorAmount, juniorInvestor);
    pool.lockJuniorCapital();
    seniorDepositAndInvest(pool, juniorAmount * 4);
    pool.lockPool();
    pool.drawdown(juniorAmount * 5);
  }

  function getInterestAccrued(
    uint256 start,
    uint256 end,
    uint256 balance,
    uint256 apr
  ) internal returns (uint256) {
    uint256 secondsElapsed = end - start;
    uint256 totalInterestPerYear = (balance * apr) / (1e18);
    uint256 interest = (totalInterestPerYear * secondsElapsed) / (365 days);
    return interest;
  }

  // TODO - remove this function because it doesn't make sense with a monthly schedule
  function periodInSeconds(TranchedPool pool) internal returns (uint256) {
    // return pool.creditLine().nextDueTime().sub(pool.creditLine().previousDueTime());
    return 28 days;
  }

  function addToGoList(address user) internal impersonating(GF_OWNER) {
    gfConfig.addToGoList(user);
  }
}
