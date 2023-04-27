// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "../BaseTest.t.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {LeverageRatioStrategy} from "../../../protocol/core/LeverageRatioStrategy.sol";
import {FixedLeverageRatioStrategy} from "../../../protocol/core/FixedLeverageRatioStrategy.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchFactory} from "../../../protocol/core/GoldfinchFactory.sol";
import {TranchedPoolBuilder} from "../../helpers/TranchedPoolBuilder.t.sol";
import {TestSeniorPool} from "../../../test/TestSeniorPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {TranchedPoolImplementationRepository} from "../../../protocol/core/TranchedPoolImplementationRepository.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";
import {TranchingLogic} from "../../../protocol/core/TranchingLogic.sol";
import {TestERC20} from "../../../test/TestERC20.sol";
import {Go} from "../../../protocol/core/Go.sol";
import {ITestUniqueIdentity0612} from "../../../test/ITestUniqueIdentity0612.t.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {BackerRewards} from "../../../rewards/BackerRewards.sol";
import {MonthlyScheduleRepo} from "../../../protocol/core/schedule/MonthlyScheduleRepo.sol";

contract FixedLeverageRatioStrategyBaseTest is BaseTest {
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;
  LeverageRatioStrategy internal fixedStrat;
  TranchedPoolBuilder internal tpBuilder;
  TestSeniorPool internal sp;
  TestERC20 internal usdc;

  function setUp() public override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    // USDC setup
    usdc = TestERC20(address(protocol.usdc()));

    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    FixedLeverageRatioStrategy _fixedStrat = new FixedLeverageRatioStrategy();
    _fixedStrat.initialize(GF_OWNER, gfConfig);
    fixedStrat = LeverageRatioStrategy(address(_fixedStrat));

    // SeniorPool setup
    sp = new TestSeniorPool();
    sp.initialize(GF_OWNER, gfConfig);
    sp.initializeEpochs();

    // PoolTokens setup
    PoolTokens poolTokens = new PoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);

    // TranchedPool and CreditLine setup
    TranchedPool tpImpl = new TranchedPool();
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
    // Allows the builder to create pools
    gfFactory.grantRole(gfFactory.OWNER_ROLE(), address(tpBuilder));

    // UniqueIdentity setup
    ITestUniqueIdentity0612 uniqueIdentity = ITestUniqueIdentity0612(
      deployCode("TestUniqueIdentity.sol")
    );
    uniqueIdentity.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uniqueIdentity.setSupportedUIDTypes(supportedUids, supportedUidValues);

    // BackerRewards setup
    BackerRewards backerRewards = new BackerRewards();
    backerRewards.__initialize__(GF_OWNER, gfConfig);

    Go go = new Go();
    go.initialize(GF_OWNER, gfConfig, address(uniqueIdentity));

    gfConfig.addToGoList(GF_OWNER);
    gfConfig.addToGoList(address(sp));

    gfConfig.setAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation), address(clImpl));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.BackerRewards), address(backerRewards));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy), address(fixedStrat));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(tpImplRepo)
    );
    // Set a 4x leverage ratio
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LeverageRatio), 4e18);

    fuzzHelper.exclude(address(sp));
    fuzzHelper.exclude(address(gfConfig));
    fuzzHelper.exclude(address(gfFactory));
    fuzzHelper.exclude(address(fixedStrat));
    fuzzHelper.exclude(address(tpBuilder));
    fuzzHelper.exclude(address(clImpl));
    fuzzHelper.exclude(address(tpImpl));
    fuzzHelper.exclude(address(tpImplRepo));
    fuzzHelper.exclude(address(poolTokens));
    fuzzHelper.exclude(address(TranchingLogic));
    fuzzHelper.exclude(address(go));
    fuzzHelper.exclude(address(uniqueIdentity));
    fuzzHelper.exclude(address(backerRewards));

    _stopImpersonation();
  }

  function defaultTranchedPool()
    internal
    impersonating(GF_OWNER)
    returns (TranchedPool, CreditLine)
  {
    (TranchedPool tp, CreditLine cl) = tpBuilder.build(GF_OWNER);
    fuzzHelper.exclude(address(tp));
    fuzzHelper.exclude(address(tp.creditLine()));
    tp.grantRole(tp.SENIOR_ROLE(), address(sp));
    return (tp, cl);
  }

  function depositToTpFrom(
    TranchedPool tp,
    address user,
    uint256 amount
  ) internal impersonating(user) returns (uint256) {
    usdc.approve(address(tp), amount);
    return tp.deposit(uint256(ITranchedPool.Tranches.Junior), amount);
  }

  function lockJuniorCap(TranchedPool tp) internal impersonating(tp.creditLine().borrower()) {
    tp.lockJuniorCapital();
  }

  function lock(TranchedPool tp) internal impersonating(tp.creditLine().borrower()) {
    tp.lockPool();
  }
}
