// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "../BaseTest.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {Fidu} from "../../../protocol/core/Fidu.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {TestSeniorPool} from "../../../test/TestSeniorPool.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";

contract FiduTest is BaseTest {
  GoldfinchConfig internal gfConfig;
  Fidu internal fidu;
  TestSeniorPool internal seniorPool;

  function setUp() public override {
    super.setUp();
    _startImpersonation(GF_OWNER);
    fidu = Fidu(address(protocol.fidu()));
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));
    seniorPool = new TestSeniorPool();
    seniorPool.initialize(GF_OWNER, gfConfig);
    seniorPool.initializeEpochs();
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPool), address(seniorPool));
    fuzzHelper.exclude(address(fidu));
    fuzzHelper.exclude(address(seniorPool));
    _stopImpersonation();
  }

  function testInitializationAssignsOwner() public {
    assertTrue(fidu.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
  }

  function testCannotBeInitializedTwice() public {
    vm.expectRevert("Contract instance has already been initialized");
    fidu.initialize("Fidu", "FIDU");
  }

  function testMinterCanMintTo(uint256 mintAmount) public impersonating(GF_OWNER) {
    mintAmount = bound(mintAmount, 0, fiduVal(100_000_000_000));
    // Increase SeniorPool assets so we can mint very large amounts
    seniorPool.setUsdcAvailable(usdcVal(100_000_000_000));

    fidu.mintTo(address(this), mintAmount);
    assertEq(fidu.balanceOf(address(this)), mintAmount);
  }

  function testNonMinterCantMintTo(
    address notMinter,
    uint256 mintAmount
  ) public onlyAllowListed(notMinter) impersonating(notMinter) {
    mintAmount = bound(mintAmount, 0, fiduVal(100_000_000_000));
    // Increase SeniorPool assets so we can mint very large amounts
    seniorPool.setUsdcAvailable(usdcVal(100_000_000_000));
    vm.expectRevert("ERC20PresetMinterPauser: must have minter role to mint");
    fidu.mintTo(address(this), mintAmount);
  }

  function testMinterCanBurnFrom(
    uint256 mintAmount,
    uint256 burnAmount
  ) public impersonating(GF_OWNER) {
    mintAmount = bound(mintAmount, 0, fiduVal(100_000_000_000));
    burnAmount = bound(burnAmount, 0, mintAmount);
    // Increase SeniorPool assets so we can mint very large amounts
    seniorPool.setUsdcAvailable(usdcVal(100_000_000_000));

    fidu.mintTo(address(this), mintAmount);
    assertEq(fidu.balanceOf(address(this)), mintAmount);

    fidu.burnFrom(address(this), burnAmount);

    assertEq(fidu.balanceOf(address(this)), mintAmount - burnAmount);
  }

  function testNonMinterCantBurnFrom(
    address notMinter,
    uint256 mintAmount,
    uint256 burnAmount
  ) public onlyAllowListed(notMinter) {
    mintAmount = bound(mintAmount, 0, fiduVal(100_000_000_000));
    burnAmount = bound(burnAmount, 0, mintAmount);
    // Increase SeniorPool assets so we can mint very large amounts
    seniorPool.setUsdcAvailable(usdcVal(100_000_000_000));

    _startImpersonation(GF_OWNER);
    fidu.mintTo(address(this), mintAmount);
    assertEq(fidu.balanceOf(address(this)), mintAmount);

    _startImpersonation(notMinter);
    vm.expectRevert("ERC20PresetMinterPauser: Must have minter role to burn");
    fidu.burnFrom(address(this), burnAmount);
  }

  function testCannotMintIfItWillCauseAnAssetLiabilityMismatch(
    uint256 usdcAvailable,
    uint256 mintAmount
  ) public impersonating(GF_OWNER) {
    usdcAvailable = bound(usdcAvailable, 0, usdcVal(100_000_000_000));
    seniorPool.setUsdcAvailable(usdcAvailable);
    // If mintAmount > assets + 1e6 this causes an asset/liability mismatch. In this case the assets are usdcAvailable.
    mintAmount = bound(
      mintAmount,
      seniorPool.usdcToFidu(usdcAvailable + usdcVal(1) + 1),
      seniorPool.usdcToFidu(usdcVal(100_000_000_000_000_000_000))
    );
    vm.expectRevert("Cannot mint: it would create an asset/liability mismatch");
    fidu.mintTo(address(this), mintAmount);
  }

  function testCanMintUpToAssetsPlusMismatchThreshold(
    uint256 usdcAvailable,
    uint256 mintAmount
  ) public impersonating(GF_OWNER) {
    usdcAvailable = bound(usdcAvailable, usdcVal(100), usdcVal(100_000_000_000));
    seniorPool.setUsdcAvailable(usdcAvailable);
    // The threshold is 1e6 and usdcAvailable = assets so we should be able to mint up to usdcAvailable + 1e6
    mintAmount = bound(mintAmount, 0, seniorPool.usdcToFidu(usdcAvailable + 1e6));
    fidu.mintTo(address(this), mintAmount);
    assertEq(fidu.balanceOf(address(this)), mintAmount);
  }
}
