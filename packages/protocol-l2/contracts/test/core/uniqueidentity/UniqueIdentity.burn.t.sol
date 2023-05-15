// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentityBurnTest is UniqueIdentityBaseTest {
  function testBurnDecreasesBalance(
    address recipient,
    uint256 amountToMint
  ) public onlyAllowListed(recipient) impersonating(GF_OWNER) {
    amountToMint = bound(amountToMint, 1, type(uint256).max);
    uid._mintForTest(recipient, 0, amountToMint, bytes(""));
    uid._burnForTest(recipient, 0);
    assertEq(uid.balanceOf(recipient, 0), amountToMint - 1);
  }

  function testCanBurnWithValidSig(
    uint256 signerKey,
    address uidHolder
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);

    assertZero(uid.balanceOf(uidHolder, 0));
  }

  function testSigWithWrongAccountReverts(
    uint256 signerKey,
    address uidHolder,
    address notUidHolder
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    vm.assume(uidHolder != notUidHolder);
    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: notUidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    vm.expectRevert("Invalid signer");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testSigWithWrongIdReverts(
    uint256 signerKey,
    address uidHolder
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    vm.expectRevert("Invalid signer");
    // Sig was for type 0 but we try and burn for type 1
    uid.burn(uidHolder, 1, block.timestamp + 1 days, sig);
  }

  function testSigWithWrongChainIdReverts(
    uint256 signerKey,
    address uidHolder,
    uint256 invalidChainId
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    vm.assume(invalidChainId != block.chainid);
    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: invalidChainId,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    vm.expectRevert("Invalid signer");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testSignerWithoutSignerRoleReverts(
    uint256 signerKey,
    address uidHolder
  ) public validPrivateKey(signerKey) onlyAllowListed(uidHolder) {
    uid._mintForTest(uidHolder, 0, 1, "");
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    vm.expectRevert("Invalid signer");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testExpiredTimestampReverts(
    uint256 signerKey,
    address uidHolder,
    uint256 burnTime
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    uint256 expiresAt = block.timestamp + 1 days;
    burnTime = bound(burnTime, expiresAt, type(uint256).max);

    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    vm.warp(burnTime);

    _startImpersonation(uidHolder);
    vm.expectRevert("Signature has expired");
    uid.burn(uidHolder, 0, expiresAt, sig);
  }

  function testSigWithWrongUidAddressReverts(
    uint256 signerKey,
    address uidHolder,
    address invalidUidAddress
  ) public validPrivateKey(signerKey) onlyAllowListed(uidHolder) {
    vm.assume(invalidUidAddress != address(uid));

    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: invalidUidAddress,
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    vm.expectRevert("Invalid signer");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testReusedSigReverts(
    uint256 signerKey,
    address uidHolder
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(uidHolder);
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);

    assertZero(uid.balanceOf(uidHolder, 0));

    vm.expectRevert("Invalid signer");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testEmptySigReverts() public {
    vm.expectRevert("ECDSA: invalid signature length");
    uid.burn(address(this), 0, block.timestamp + 1, "");
  }

  function testBurnsForSenderBearingValidSig(
    uint256 signerKey,
    address uidHolder,
    address anySender
  ) public onlyAllowListed(uidHolder) onlyAllowListed(anySender) validPrivateKey(signerKey) {
    vm.assume(uidHolder != anySender);

    uid._mintForTest(uidHolder, 0, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    _startImpersonation(anySender);
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testFromZeroAddressReverts(uint256 signerKey) public validPrivateKey(signerKey) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 0,
      recipient: address(0),
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.expectRevert("ERC1155: burn from the zero address");
    uid.burn(address(0), 0, block.timestamp + 1 days, sig);
  }

  function testAccountNotHavingTokenIdReverts(
    uint256 signerKey,
    address notUidHolder
  ) public onlyAllowListed(notUidHolder) validPrivateKey(signerKey) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 0,
      recipient: notUidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.expectRevert("ERC1155: burn amount exceeds balance");
    uid.burn(notUidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testBurnsAccountWithTokenId(
    uint256 signerKey,
    address uidHolder,
    uint256 uidType
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    // Bound within range of valid UIDs
    uidType = bound(uidType, 0, 4);

    uid._mintForTest(uidHolder, uidType, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    uid.burn(uidHolder, uidType, block.timestamp + 1 days, sig);

    assertZero(uid.balanceOf(uidHolder, uidType));
  }

  function testAccountNotHavingBalanceReverts(
    uint256 signerKey,
    address uidHolder
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 0,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    vm.expectRevert("ERC1155: burn amount exceeds balance");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testUnsupportedUidTypesCanBurn(
    uint256 signerKey,
    address uidHolder,
    uint256 uidType
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    // Bound within range of valid UIDs
    uidType = bound(uidType, 0, 4);

    uid._mintForTest(uidHolder, uidType, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));
    uint256[] memory uidTypes = new uint256[](0);
    bool[] memory values = new bool[](0);
    _startImpersonation(GF_OWNER);
    uid.setSupportedUIDTypes(uidTypes, values);
    _stopImpersonation();

    // Retaining the ability to burn a token of id for which minting is not supported is
    // useful for at least two reasons: (1) in case such tokens should never have been
    // mintable but were somehow minted; (2) in case we have deprecated the ability to mint
    // tokens of that id.

    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    uid.burn(uidHolder, uidType, block.timestamp + 1 days, sig);

    assertZero(uid.balanceOf(uidHolder, uidType));
  }

  function testBurnValueLessThanAmountOnTokenReverts(
    uint256 signerKey,
    address uidHolder,
    uint256 mintAmount
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    // The value in having this test is that it shows that the contract's burn function explicitly requires that
    // the entire balance have been burned.
    //
    // An implication of the behavior established by this test is, if the case ever arises in practice where a token
    // balance becomes > 1 (e.g. due to a bug or hack), we'd need to upgrade the contract to be able to burn that token.

    vm.assume(mintAmount > 1);

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));
    uid._mintForTest(uidHolder, 0, mintAmount, "");

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    vm.expectRevert("Balance after burn must be 0");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }

  function testEmitsAndEvent(
    uint256 signerKey,
    address uidHolder,
    uint256 uidType
  ) public onlyAllowListed(uidHolder) validPrivateKey(signerKey) {
    // Bound within range of valid UIDs
    uidType = bound(uidType, 0, 4);

    uid._mintForTest(uidHolder, uidType, 1, "");

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    vm.expectEmit(true, true, true, true);
    emit TransferSingle(address(this), uidHolder, address(0), uidType, 1);

    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    uid.burn(uidHolder, uidType, block.timestamp + 1 days, sig);
  }

  function testRevertsWhenPaused(
    uint256 signerKey,
    address uidHolder
  ) public validPrivateKey(signerKey) onlyAllowListed(uidHolder) {
    uid._mintForTest(uidHolder, 0, 1, "");
    address signer = vm.addr(signerKey);

    _startImpersonation(GF_OWNER);
    uid.pause();
    assertTrue(uid.paused());
    uid.grantRole(TestConstants.SIGNER_ROLE, signer);
    _stopImpersonation();

    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: block.timestamp + 1 days,
      chainId: block.chainid,
      nonce: 1,
      recipient: uidHolder,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    vm.expectRevert("ERC1155Pausable: token transfer while paused");
    uid.burn(uidHolder, 0, block.timestamp + 1 days, sig);
  }
}
