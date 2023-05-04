// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentityMintTest is UniqueIdentityBaseTest {
  function testMintIncreasesBalance(
    address recipient,
    uint256 uidType,
    uint256 amountToMint
  ) public onlyAllowListed(recipient) impersonating(GF_OWNER) {
    // Need to set the uidType to be supported before mint
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    bool[] memory values = new bool[](1);
    values[0] = true;
    uid.setSupportedUIDTypes(uidTypes, values);

    assertZero(uid.balanceOf(recipient, uidType));
    uid._mintForTest(recipient, uidType, amountToMint, bytes(""));
    assertEq(uid.balanceOf(recipient, uidType), amountToMint);
  }

  function testSigWithWrongUidTypeReverts(
    uint256 signerKey,
    address recipient
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 1,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Invalid signer");
    // We signed for uid type 1 but attempt to mint for uid type 0
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testSigWithWrongChainIdReverts(
    uint256 signerKey,
    address recipient,
    uint256 invalidChainId
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    vm.assume(invalidChainId != block.chainid);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      // WRONG CHAIN ID
      chainId: invalidChainId,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Invalid signer");
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testInvalidRecipientReverts(
    uint256 signerKey,
    address sigRecipient,
    address invalidRecipient
  )
    public
    validPrivateKey(signerKey)
    onlyAllowListed(sigRecipient)
    onlyAllowListed(invalidRecipient)
  {
    vm.assume(sigRecipient != invalidRecipient);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: sigRecipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(invalidRecipient, 1 ether);
    _startImpersonation(invalidRecipient);
    vm.expectRevert("Invalid signer");
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testSigWithWrongUidAddressReverts(
    uint256 signerKey,
    address recipient,
    address invalidUidAddress
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    vm.assume(invalidUidAddress != address(uid));
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: invalidUidAddress,
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Invalid signer");
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testExpiredTimestampReverts(
    uint256 signerKey,
    address recipient,
    uint256 mintTime
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    uint256 expiresAt = block.timestamp + 1 days;
    mintTime = bound(mintTime, expiresAt, type(uint256).max);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 uidType = 0;
    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.warp(mintTime);

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Signature has expired");
    uid.mint{value: 1 ether}(uidType, expiresAt, sig);
  }

  function testEmptySigReverts() public {
    vm.expectRevert("ECDSA: invalid signature length");
    uid.mint({id: 0, expiresAt: block.timestamp + 1 days, signature: ""});
  }

  function testRevertsForSignerWithoutSignerRole(
    uint256 signerKey,
    address recipient
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Invalid signer");
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testReusedSigReverts(
    uint256 signerKey,
    address recipient
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    uint256 mintCost = uid.MINT_COST_PER_TOKEN();
    uid.mint{value: mintCost}(0, expiresAt, sig);

    assertEq(uid.balanceOf(recipient, 0), 1);

    // Now try again
    vm.expectRevert("Invalid signer");
    uid.mint{value: mintCost}(0, expiresAt, sig);
  }

  function testMintsForSignerWithSignerRole(
    uint256 signerKey,
    address recipient
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    uid.mint{value: uid.MINT_COST_PER_TOKEN()}(0, expiresAt, sig);

    assertEq(uid.balanceOf(recipient, 0), 1);
  }

  function testRevertsForInvalidUidTypes(
    uint256 signerKey,
    address recipient,
    uint256 uidType
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    uidType = bound(uidType, 5, type(uint256).max);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("Token id not supported");
    uid.mint{value: 1 ether}(uidType, expiresAt, sig);
  }

  function testWorksForValidUidTypes(
    uint256 signerKey,
    address recipient,
    uint256 uidType
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    // Valid uidTypes are 0...4
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    uid.mint{value: uid.MINT_COST_PER_TOKEN()}(uidType, expiresAt, sig);

    assertEq(uid.balanceOf(recipient, uidType), 1);
  }

  function testWorksIfPaymentGteMintFee(
    uint256 signerKey,
    address recipient,
    uint256 payment
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    payment = bound(payment, uid.MINT_COST_PER_TOKEN(), type(uint256).max);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, payment);
    _startImpersonation(recipient);
    uid.mint{value: payment}(0, expiresAt, sig);

    assertEq(uid.balanceOf(recipient, 0), 1);
  }

  function testRevertsForInsufficientPayment(
    uint256 signerKey,
    address recipient,
    uint256 payment
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    payment = bound(payment, 0, uid.MINT_COST_PER_TOKEN() - 1);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, payment);
    _startImpersonation(recipient);
    vm.expectRevert("Token mint requires 0.00083 ETH");
    uid.mint{value: payment}(0, expiresAt, sig);
  }

  function testRevertsForAddressWithExistingBalance(
    uint256 signerKey,
    address recipient,
    uint256 uidType
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    // Valid uidTypes are 0...4
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    // Fund address so it can mint
    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    uint256 mintCost = uid.MINT_COST_PER_TOKEN();
    uid.mint{value: mintCost}(uidType, expiresAt, sig);
    assertEq(uid.balanceOf(recipient, uidType), 1);

    // Try minting again
    sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 1,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.expectRevert("Balance before mint must be 0");
    uid.mint{value: mintCost}(uidType, expiresAt, sig);
  }

  function testEmitsTransferSingle(
    uint256 signerKey,
    address recipient,
    uint256 uidType
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    uidType = bound(uidType, 0, 4);
    grantRole(address(uid), TestConstants.SIGNER_ROLE, vm.addr(signerKey));

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: uidType,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.expectEmit(true, true, true, true);
    emit TransferSingle(recipient, address(0), recipient, uidType, 1);

    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    uid.mint{value: uid.MINT_COST_PER_TOKEN()}(uidType, expiresAt, sig);

    assertEq(uid.balanceOf(recipient, uidType), 1);
  }

  function testRevertsWhenPaused(
    uint256 signerKey,
    address recipient
  ) public validPrivateKey(signerKey) onlyAllowListed(recipient) {
    address signer = vm.addr(signerKey);
    _startImpersonation(GF_OWNER);
    uid.grantRole(TestConstants.SIGNER_ROLE, signer);
    uid.pause();
    _stopImpersonation();
    assertTrue(uid.paused());

    uint256 expiresAt = block.timestamp + 1 days;
    bytes memory sig = signForMint({
      uidType: 0,
      expiresAt: expiresAt,
      chainId: block.chainid,
      nonce: 0,
      recipient: recipient,
      uidContract: address(uid),
      signerPrivateKey: signerKey
    });

    vm.deal(recipient, 1 ether);
    _startImpersonation(recipient);
    vm.expectRevert("ERC1155Pausable: token transfer while paused");
    uid.mint{value: 1 ether}(0, expiresAt, sig);
  }

  function testBalanceOfReturnsZeroForNonMintedToken(address uidHolder, uint256 uidType) public {
    vm.assume(uidHolder != address(0));
    assertZero(uid.balanceOf(uidHolder, uidType));
  }
}
