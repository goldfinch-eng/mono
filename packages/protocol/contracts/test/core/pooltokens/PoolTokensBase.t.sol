// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "../BaseTest.t.sol";
import {SeniorPool} from "../../../protocol/core/SeniorPool.sol";
import {FixedLeverageRatioStrategy} from "../../../protocol/core/FixedLeverageRatioStrategy.sol";
import {WithdrawalRequestToken} from "../../../protocol/core/WithdrawalRequestToken.sol";
import {TestERC20} from "../../../test/TestERC20.sol";
import {TestPoolTokens} from "../../../test/TestPoolTokens.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchFactory} from "../../../protocol/core/GoldfinchFactory.sol";
import {Fidu} from "../../../protocol/core/Fidu.sol";
import {GFI} from "../../../protocol/core/GFI.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {BackerRewards} from "../../../rewards/BackerRewards.sol";
import {StakingRewards} from "../../../rewards/StakingRewards.sol";
import {TranchedPoolBuilder} from "../../helpers/TranchedPoolBuilder.t.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {Go} from "../../../protocol/core/Go.sol";
import {ITestUniqueIdentity0612} from "../../../test/ITestUniqueIdentity0612.t.sol";
import {TranchedPoolImplementationRepository} from "../../../protocol/core/TranchedPoolImplementationRepository.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

contract PoolTokensBaseTest is BaseTest {
  GFI internal gfi;
  Fidu internal fidu;
  TestERC20 internal usdc;
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;
  TestPoolTokens internal poolTokens;
  BackerRewards internal backerRewards;
  StakingRewards internal stakingRewards;
  TranchedPoolBuilder internal tpBuilder;
  SeniorPool internal sp;
  Go internal go;
  ITestUniqueIdentity0612 internal uid;

  function setUp() public virtual override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));
    usdc = TestERC20(address(protocol.usdc()));
    fidu = Fidu(address(protocol.fidu()));
    gfi = GFI(address(protocol.gfi()));

    // SeniorPool
    sp = new SeniorPool();
    sp.initialize(GF_OWNER, gfConfig);
    sp.initializeEpochs();
    fidu.grantRole(TestConstants.MINTER_ROLE, address(sp));
    FixedLeverageRatioStrategy strat = new FixedLeverageRatioStrategy();
    strat.initialize(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPool), address(sp));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPoolStrategy), address(strat));

    // WithdrawalRequestToken setup
    WithdrawalRequestToken requestTokens = new WithdrawalRequestToken();
    requestTokens.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.WithdrawalRequestToken),
      address(requestTokens)
    );

    // PoolTokens setup
    poolTokens = new TestPoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));

    // BackerRewards setup
    backerRewards = new BackerRewards();
    backerRewards.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.BackerRewards), address(backerRewards));

    stakingRewards = StakingRewards(address(protocol.stakingRewards()));

    tpBuilder = new TranchedPoolBuilder(address(gfFactory), address(sp));
    gfFactory.grantRole(gfFactory.OWNER_ROLE(), address(tpBuilder)); // Allows the builder to create pools

    uid = ITestUniqueIdentity0612(deployCode("TestUniqueIdentity.sol"));
    uid.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);

    go = new Go();
    go.initialize(GF_OWNER, gfConfig, address(uid));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));

    // TranchedPool and CreditLine setup
    TestTranchedPool tpImpl = new TestTranchedPool();
    TranchedPoolImplementationRepository tpImplRepo = new TranchedPoolImplementationRepository();
    tpImplRepo.initialize(GF_OWNER, address(tpImpl));
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(tpImplRepo)
    );

    CreditLine clImpl = new CreditLine();
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation), address(clImpl));

    gfConfig.addToGoList(address(this));

    gfConfig.setNumber(uint256(ConfigOptions.Numbers.ReserveDenominator), 10);

    _stopImpersonation();
  }

  function bigVal(uint256 x) internal pure returns (uint256) {
    return x * 1e18;
  }

  function defaultTp() internal impersonating(GF_OWNER) returns (TestTranchedPool, CreditLine) {
    (TestTranchedPool tp, CreditLine cl) = tpBuilder.build(GF_OWNER);
    fuzzHelper.exclude(address(tp));
    fuzzHelper.exclude(address(tp.creditLine()));
    tp.grantRole(tp.SENIOR_ROLE(), address(sp));
    return (tp, cl);
  }
}
