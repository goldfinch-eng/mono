// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchConfigBaseTest} from "./BaseGoldfinchConfig.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoldfinchConfigTest is GoldfinchConfigBaseTest {
  function setUp() public override {
    super.setUp();
    setUpTheEnums();
  }

  function testInitializeFromOtherConfigCopiesDataFromOtherConfig() public impersonating(GF_OWNER) {
    GoldfinchConfig sourceConfig = new GoldfinchConfig();
    sourceConfig.initialize(GF_OWNER);

    sourceConfig.setNumber(0, 0);
    sourceConfig.setNumber(1, 1);
    sourceConfig.setNumber(2, 2);
    sourceConfig.setNumber(3, 3);
    sourceConfig.setNumber(4, 4);
    sourceConfig.setAddress(0, address(100));
    sourceConfig.setAddress(1, address(101));
    sourceConfig.setAddress(2, address(102));
    sourceConfig.setAddress(3, address(103));
    sourceConfig.setAddress(4, address(104));

    GoldfinchConfig destConfig = new GoldfinchConfig();
    destConfig.initialize(GF_OWNER);

    assertZero(destConfig.getNumber(0));
    assertZero(destConfig.getNumber(1));
    assertZero(destConfig.getNumber(2));
    assertZero(destConfig.getNumber(3));
    assertEq(destConfig.getAddress(0), address(0));
    assertEq(destConfig.getAddress(1), address(0));
    assertEq(destConfig.getAddress(2), address(0));
    assertEq(destConfig.getAddress(3), address(0));

    destConfig.initializeFromOtherConfig(address(sourceConfig), 4, 4);

    assertEq(destConfig.getNumber(0), 0);
    assertEq(destConfig.getNumber(1), 1);
    assertEq(destConfig.getNumber(2), 2);
    assertEq(destConfig.getNumber(3), 3);
    assertEq(destConfig.getAddress(0), address(100));
    assertEq(destConfig.getAddress(1), address(101));
    assertEq(destConfig.getAddress(2), address(102));
    assertEq(destConfig.getAddress(3), address(103));

    // Fifth number and fifth address should be 0
    assertZero(destConfig.getNumber(4));
    assertEq(destConfig.getAddress(4), address(0));
  }

  function testTheOrderOfTheEnumShouldNotChange() public {
    // The expected values here are just hardcoded in the test enums contract
    // The whole point here is to assure we have a test that fails if we change the order

    // Numbers
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.TransactionLimit)), 1);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.TotalFundsLimit)), 2);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.MaxUnderwriterLimit)), 3);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.ReserveDenominator)), 4);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.WithdrawFeeDenominator)), 5);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays)), 6);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.LatenessMaxDays)), 7);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds)), 8);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.TransferRestrictionPeriodInDays)), 9);
    assertEq(gfConfig.getNumber(uint256(ConfigOptions.Numbers.LeverageRatio)), 10);
    assertEq(
      gfConfig.getNumber(uint256(ConfigOptions.Numbers.SeniorPoolWithdrawalCancelationFeeInBps)),
      11
    );

    // Addresses
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation)),
      0xc783df8a850f42e7F7e57013759C285caa701eB6
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.Pool)),
      0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.GoldfinchFactory)),
      0x0afFE1972479c386A2Ab21a27a7f835361B6C0e9
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.CreditDesk)),
      0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.Fidu)),
      0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.TreasuryReserve)),
      0xECd9C93B79AE7C1591b1fB5323BD777e86E150d5
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.TrustedForwarder)),
      0x956868751Cc565507B3B58E53a6f9f41B56bed74
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.CUSDCContract)),
      0x5B281A6DdA0B271e91ae35DE655Ad301C976edb1
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.GoldfinchConfig)),
      0x0000000000000000000000000000000000000008
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.FiduUSDCCurveLP)),
      0x55A8a39bc9694714E2874c1ce77aa1E599461E18
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository)),
      0x0000000000000000000000000000000000000009
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.WithdrawalRequestToken)),
      0x000000000000000000000000000000000000000A
    );
    assertEq(
      gfConfig.getAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo)),
      0x000000000000000000000000000000000000000b
    );
  }

  function setUpTheEnums() private impersonating(GF_OWNER) {
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.TransactionLimit), 1);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.TotalFundsLimit), 2);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.MaxUnderwriterLimit), 3);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.ReserveDenominator), 4);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.WithdrawFeeDenominator), 5);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays), 6);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessMaxDays), 7);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.DrawdownPeriodInSeconds), 8);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.TransferRestrictionPeriodInDays), 9);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LeverageRatio), 10);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.SeniorPoolWithdrawalCancelationFeeInBps), 11);

    // These are random addresses
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CreditLineImplementation),
      0xc783df8a850f42e7F7e57013759C285caa701eB6
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.Fidu),
      0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.Pool),
      0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CreditDesk),
      0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.GoldfinchFactory),
      0x0afFE1972479c386A2Ab21a27a7f835361B6C0e9
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TrustedForwarder),
      0x956868751Cc565507B3B58E53a6f9f41B56bed74
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.CUSDCContract),
      0x5B281A6DdA0B271e91ae35DE655Ad301C976edb1
    );
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.GoldfinchConfig), address(8));
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.FiduUSDCCurveLP),
      0x55A8a39bc9694714E2874c1ce77aa1E599461E18
    );
    gfConfig.setAddress(
      uint256(ConfigOptions.Addresses.TranchedPoolImplementationRepository),
      address(9)
    );
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.WithdrawalRequestToken), address(10));
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.MonthlyScheduleRepo), address(11));
    gfConfig.setTreasuryReserve(0xECd9C93B79AE7C1591b1fB5323BD777e86E150d5);
  }
}
