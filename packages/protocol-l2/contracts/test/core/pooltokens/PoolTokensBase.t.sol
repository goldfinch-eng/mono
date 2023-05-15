// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {BaseTest} from "../BaseTest.t.sol";
import {TestERC20} from "../../../test/TestERC20.sol";
import {TestPoolTokens} from "../../../test/TestPoolTokens.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchFactory} from "../../../protocol/core/GoldfinchFactory.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {TranchedPoolBuilder} from "../../helpers/TranchedPoolBuilder.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {Go} from "../../../protocol/core/Go.sol";
import {TestUniqueIdentity} from "../../../test/TestUniqueIdentity.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {MonthlyScheduleRepo} from "../../../protocol/core/schedule/MonthlyScheduleRepo.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract PoolTokensBaseTest is BaseTest {
  TestERC20 internal usdc;
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;
  TestPoolTokens internal poolTokens;
  TranchedPoolBuilder internal tpBuilder;
  Go internal go;
  TestUniqueIdentity internal uid;

  function setUp() public virtual override {
    super.setUp();
    _startImpersonation(GF_OWNER);

    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));
    usdc = TestERC20(address(protocol.usdc()));

    // PoolTokens setup
    poolTokens = new TestPoolTokens();
    poolTokens.__initialize__(GF_OWNER, gfConfig);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.PoolTokens), address(poolTokens));

    // MonthlyScheduleRepository setup
    MonthlyScheduleRepo monthlyScheduleRepo = new MonthlyScheduleRepo();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.MonthlyScheduleRepo),
      address(monthlyScheduleRepo)
    );
    fuzzHelper.exclude(address(monthlyScheduleRepo));
    fuzzHelper.exclude(address(monthlyScheduleRepo.periodMapper()));

    tpBuilder = new TranchedPoolBuilder({
      _gfFactory: gfFactory,
      _monthlyScheduleRepo: monthlyScheduleRepo
    });
    gfFactory.grantRole(gfFactory.OWNER_ROLE(), address(tpBuilder)); // Allows the builder to create pools

    uid = new TestUniqueIdentity();
    uid.initialize(GF_OWNER, "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);

    go = new Go();
    go.initialize(GF_OWNER, gfConfig, uid);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.Go), address(go));

    // TranchedPool setup
    TranchedPool tranchedPoolImpl = new TranchedPool();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementation),
      address(tranchedPoolImpl)
    );
    UpgradeableBeacon tranchedPoolBeacon = gfFactory.createBeacon(
      ConfigOptions.Addresses.TranchedPoolImplementation,
      GF_OWNER
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolBeacon),
      address(tranchedPoolBeacon)
    );
    fuzzHelper.exclude(address(tranchedPoolImpl));
    fuzzHelper.exclude(address(tranchedPoolBeacon));

    // CreditLine setup
    CreditLine creditLineImpl = new CreditLine();
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CreditLineImplementation),
      address(creditLineImpl)
    );
    fuzzHelper.exclude(address(creditLineImpl));
    UpgradeableBeacon creditLineBeacon = gfFactory.createBeacon(
      ConfigOptions.Addresses.CreditLineImplementation,
      GF_OWNER
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CreditLineBeacon),
      address(creditLineBeacon)
    );
    fuzzHelper.exclude(address(creditLineBeacon));

    gfConfig.addToGoList(address(this));

    gfConfig.setNumber(uint256(ConfigOptions.Numbers.ReserveDenominator), 10);

    _stopImpersonation();
  }

  function bigVal(uint256 x) internal pure returns (uint256) {
    return x * 1e18;
  }

  function defaultTp() internal impersonating(GF_OWNER) returns (TranchedPool, CreditLine) {
    (TranchedPool tp, CreditLine cl) = tpBuilder.build(GF_OWNER);
    fuzzHelper.exclude(address(tp));
    fuzzHelper.exclude(address(tp.creditLine()));
    return (tp, cl);
  }

  function tpWithSchedule(
    uint256 periodsInTerm,
    uint256 periodsPerInterestPeriod,
    uint256 periodsPerPrincipalPeriod,
    uint256 gracePrincipalPeriods
  ) internal impersonating(GF_OWNER) returns (TranchedPool, CreditLine) {
    (TranchedPool tp, CreditLine cl) = tpBuilder
      .withScheduleParams(
        periodsInTerm,
        periodsPerInterestPeriod,
        periodsPerPrincipalPeriod,
        gracePrincipalPeriods
      )
      .build(GF_OWNER);
    fuzzHelper.exclude(address(tp));
    fuzzHelper.exclude(address(tp.creditLine()));
    return (tp, cl);
  }
}
