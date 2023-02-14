// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentityMintToTest is UniqueIdentityBaseTest {
  function testSigWithWrongUidTypeReverts(
    uint256 signerKey,
    address sender,
    address receiver
  ) public validPrivateKey(signerKey) onlyAllowListed(sender) onlyAllowListed(receiver) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 1,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Invalid signer");
    // We signed for uid type 1 but attempt to mint for uid type 0
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testSigWithWrongChainIdReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 invalidChainId
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    vm.assume(invalidChainId != block.chainid);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      // WRONG CHAIN ID
      chainId: invalidChainId,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Invalid signer");
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testInvalidRecipientReverts(
    uint256 signerKey,
    address sender,
    address sigReceiver,
    address invalidReceiver
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(sigReceiver));
    vm.assume(fuzzHelper.isAllowed(invalidReceiver));
    vm.assume(sigReceiver != invalidReceiver);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: sigReceiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Invalid signer");

    uid.mintTo{value: 1 ether}(invalidReceiver, 0, expiresAt, sig);
  }

  function testInvalidSenderReverts(
    uint256 signerKey,
    address sender,
    address invalidSender,
    address receiver
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(invalidSender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    vm.assume(sender != invalidSender);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(invalidSender, 1 ether);
    _startImpersonation(invalidSender);
    vm.expectRevert("Invalid signer");
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testSignerWithoutSignerRoleReverts(
    uint256 signerKey,
    address sender,
    address receiver
  ) public validPrivateKey(signerKey) onlyAllowListed(sender) onlyAllowListed(receiver) {
    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Invalid signer");
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testExpiredTimestampReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 mintTime
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    uint256 expiresAt = block.timestamp + 1 days;
    mintTime = bound(mintTime, expiresAt, type(uint256).max);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 uidType = 0;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.warp(mintTime);

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Signature has expired");
    uid.mintTo{value: 1 ether}(receiver, uidType, expiresAt, sig);
  }

  function testEmptySigReverts() public {
    vm.expectRevert("ECDSA: invalid signature length");
    uid.mintTo({
      recipient: address(this),
      id: 0,
      expiresAt: block.timestamp + 1 days,
      signature: ""
    });
  }

  function testSigWithWrongUidAddressReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    address invalidUidAddress
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    vm.assume(invalidUidAddress != address(uid));
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: invalidUidAddress,
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Invalid signer");
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testSigReuseReverts(
    uint256 signerKey,
    address sender,
    address receiver
  ) public validPrivateKey(signerKey) onlyAllowListed(sender) onlyAllowListed(receiver) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 2 ether);
    _startImpersonation(sender);
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);

    assertEq(uid.balanceOf(receiver, 0), 1);

    // Try again. It should revert this time due to nonce increase
    vm.expectRevert("Invalid signer");
    uid.mintTo{value: 1 ether}(receiver, 0, expiresAt, sig);
  }

  function testInsufficientPaymentReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 payment
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    payment = bound(payment, 0, uid.MINT_COST_PER_TOKEN() - 1);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, payment);
    _startImpersonation(sender);
    vm.expectRevert("Token mint requires 0.00083 ETH");
    uid.mintTo{value: payment}(receiver, 0, expiresAt, sig);
  }

  function testMintsForPaymentGteMin(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 payment
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    payment = bound(payment, uid.MINT_COST_PER_TOKEN(), uid.MINT_COST_PER_TOKEN() * 1e6);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, payment);
    _startImpersonation(sender);
    uid.mintTo{value: payment}(receiver, 0, expiresAt, sig);
    _stopImpersonation();

    assertEq(uid.balanceOf(receiver, 0), 1);
  }

  function testMintsForSignerWithSignerRole(
    uint256 signerKey,
    address sender,
    address receiver
  ) public validPrivateKey(signerKey) onlyAllowListed(sender) onlyAllowListed(receiver) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    uid.mintTo{value: uid.MINT_COST_PER_TOKEN()}(receiver, 0, expiresAt, sig);
    _stopImpersonation();

    assertEq(uid.balanceOf(receiver, 0), 1);
  }

  function testMintsForValidUidType(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 uidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    uid.mintTo{value: uid.MINT_COST_PER_TOKEN()}(receiver, uidType, expiresAt, sig);
    _stopImpersonation();

    assertEq(uid.balanceOf(receiver, uidType), 1);
  }

  function testDoesntMintForInvalidUidType(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 invalidUidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    invalidUidType = bound(invalidUidType, 5, type(uint256).max);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: invalidUidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("Token id not supported");
    uid.mintTo{value: 1 ether}(receiver, invalidUidType, expiresAt, sig);
  }

  function testDuplicateMintForSameUidReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 uidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uid._mintForTest(sender, uidType, 1, "");

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 1,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("msgSender already owns UID");
    uid.mintTo{value: 1 ether}(receiver, uidType, expiresAt, sig);
  }

  function testDuplicateMintForDifferentUidReverts(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 uidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    vm.assume(sender != receiver);
    uidType = bound(uidType, 0, 4);

    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 2 ether);
    _startImpersonation(sender);
    uid.mintTo{value: 1 ether}(receiver, uidType, expiresAt, sig);

    assertEq(uid.balanceOf(receiver, uidType), 1);

    sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 1,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });
    vm.expectRevert("Balance before mint must be 0");
    uid.mintTo{value: 1 ether}(receiver, uidType, expiresAt, sig);
  }

  function testEmitsTransferSingleEvent(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 uidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.expectEmit(true, true, true, true);
    emit TransferSingle(sender, address(0), receiver, uidType, 1);

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    uid.mintTo{value: uid.MINT_COST_PER_TOKEN()}(receiver, uidType, expiresAt, sig);
  }

  function testRevertsWhenPaused(
    uint256 signerKey,
    address sender,
    address receiver,
    uint256 uidType
  ) public validPrivateKey(signerKey) {
    vm.assume(fuzzHelper.isAllowed(sender));
    vm.assume(fuzzHelper.isAllowed(receiver));
    uidType = bound(uidType, 0, 4);

    _startImpersonation(GF_OWNER);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));
    uid.pause();
    _stopImpersonation();
    assertTrue(uid.paused());

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMintTo({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      sender: sender,
      receiver: receiver,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(sender, 1 ether);
    _startImpersonation(sender);
    vm.expectRevert("ERC1155Pausable: token transfer while paused");
    uid.mintTo{value: 1 ether}(receiver, uidType, expiresAt, sig);
  }
}
