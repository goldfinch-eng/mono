// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {BaseTest} from "./BaseTest.t.sol";
import {WithdrawalRequestToken} from "../../protocol/core/WithdrawalRequestToken.sol";
import {SeniorPool} from "../../protocol/core/SeniorPool.sol";
import {ConfigOptions} from "../../protocol/core/ConfigOptions.sol";
import {GoldfinchFactory} from "../../protocol/core/GoldfinchFactory.sol";
import {GoldfinchConfig} from "../../protocol/core/GoldfinchConfig.sol";

contract WithdrawalRequestTokenTest is BaseTest {
  WithdrawalRequestToken private token;
  SeniorPool private seniorPool;
  GoldfinchConfig internal gfConfig;
  GoldfinchFactory internal gfFactory;

  function setUp() public override {
    super.setUp();

    // GoldfinchConfig setup
    gfConfig = GoldfinchConfig(address(protocol.gfConfig()));

    // GoldfinchFactory setup
    gfFactory = GoldfinchFactory(address(protocol.gfFactory()));

    // TODO - we should deploy this behind a proxy because that's what we do for mainnet
    token = new WithdrawalRequestToken();
    token.__initialize__(GF_OWNER, gfConfig);

    // TODO - we should deploy this behind a proxy because that's what we do for mainnet
    seniorPool = new SeniorPool();
    _startImpersonation(GF_OWNER);
    gfConfig.setAddress(uint256(ConfigOptions.Addresses.SeniorPool), address(seniorPool));
    _stopImpersonation();

    fuzzHelper.exclude(address(token));
    fuzzHelper.exclude(address(seniorPool));
  }

  function testInitializationShouldRevertIfCalledAgain() public {
    vm.expectRevert("Contract instance has already been initialized");
    token.__initialize__(GF_OWNER, gfConfig);
  }

  function testMintRevertsWhenCalledByNonSeniorPool(
    address notSeniorPool,
    address tokenOwner
  ) public onlyAllowListed(notSeniorPool) impersonating(notSeniorPool) {
    vm.expectRevert(bytes("NA"));
    token.mint(tokenOwner);
  }

  function testMintSucceedsForSeniorPool(address tokenOwner) public onlyAllowListed(tokenOwner) {
    assertEq(mint(tokenOwner), 1);
    assertEq(token.balanceOf(tokenOwner), 1);
  }

  function testBurnRevertsWhenCalledByNonSeniorPool(
    address notSeniorPool,
    address tokenOwner
  ) public onlyAllowListed(notSeniorPool) onlyAllowListed(tokenOwner) impersonating(notSeniorPool) {
    vm.expectRevert(bytes("NA"));
    token.burn(1);

    uint256 tokenId = mint(tokenOwner);
    vm.expectRevert(bytes("NA"));
    token.burn(tokenId);
  }

  function testBurnSucceedsForSeniorPool(
    address tokenOwner
  ) public onlyAllowListed(tokenOwner) impersonating(address(seniorPool)) {
    uint256 tokenId = mint(tokenOwner);
    assertEq(token.balanceOf(tokenOwner), 1);

    token.burn(tokenId);
    assertZero(token.balanceOf(tokenOwner));
  }

  function testApproveReverts(
    address tokenOwner,
    address approvedAddress
  ) public onlyAllowListed(tokenOwner) onlyAllowListed(approvedAddress) impersonating(tokenOwner) {
    uint256 tokenId = mint(tokenOwner);

    vm.expectRevert("Disabled");
    token.approve(approvedAddress, tokenId);
  }

  function testSetApprovalForAllReverts(
    address tokenOwner,
    address approvedAddress,
    bool approved
  ) public onlyAllowListed(tokenOwner) onlyAllowListed(approvedAddress) impersonating(tokenOwner) {
    mint(tokenOwner);

    vm.expectRevert("Disabled");
    token.setApprovalForAll(approvedAddress, approved);
  }

  function testTransferFromReverts(
    address tokenOwner,
    address receiver
  ) public onlyAllowListed(tokenOwner) onlyAllowListed(receiver) impersonating(tokenOwner) {
    uint256 tokenId = mint(tokenOwner);

    vm.expectRevert("Disabled");
    token.transferFrom(tokenOwner, receiver, tokenId);
  }

  function testSafeTransferFromReverts(
    address tokenOwner,
    address receiver,
    bytes memory data
  ) public onlyAllowListed(tokenOwner) onlyAllowListed(receiver) impersonating(tokenOwner) {
    uint256 tokenId = mint(tokenOwner);

    vm.expectRevert("Disabled");
    token.safeTransferFrom(tokenOwner, receiver, tokenId);

    vm.expectRevert("Disabled");
    token.safeTransferFrom(tokenOwner, receiver, tokenId, data);
  }

  /// @notice Impersonate the senior pool and mint a token
  function mint(address receiver) private impersonating(address(seniorPool)) returns (uint256) {
    return token.mint(receiver);
  }
}
