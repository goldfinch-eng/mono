// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";

contract UniqueIdentityBaseTest is BaseTest {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;
  TestUniqueIdentity internal uid;

  function setUp() public virtual override {
    super.setUp();

    uid = new TestUniqueIdentity();
    uid.initialize(GF_OWNER, address(protocol.gfConfig()), "UNIQUE-IDENTITY");
    uint256[] memory supportedUids = new uint256[](5);
    bool[] memory supportedUidValues = new bool[](5);
    for (uint256 i = 0; i < 5; ++i) {
      supportedUids[i] = i;
      supportedUidValues[i] = true;
    }

    _startImpersonation(GF_OWNER);
    uid.setSupportedUIDTypes(supportedUids, supportedUidValues);
    _stopImpersonation();

    fuzzHelper.exclude(address(uid));
  }

  /// @notice Generate a valid signature for `mint` given a private key
  function signForMint(
    uint256 uidType,
    uint256 expiresAt,
    uint256 chainId,
    uint256 nonce,
    address recipient,
    address uidContract,
    uint256 signerPrivateKey
  ) internal pure returns (bytes memory) {
    bytes memory packed = abi.encodePacked(
      recipient,
      uidType,
      expiresAt,
      address(uidContract),
      nonce,
      chainId
    );
    bytes32 digest = keccak256(packed);
    bytes32 ethSignedMessagePayload = digest.toEthSignedMessageHash();
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessagePayload);
    return abi.encodePacked(r, s, v);
  }

  /// Generate a valid signature for `mintTo` given a private key
  function signForMintTo(
    uint256 uidType,
    uint256 expiresAt,
    uint256 chainId,
    uint256 nonce,
    address sender,
    address receiver,
    address uidContract,
    uint256 signerPrivateKey
  ) internal pure returns (bytes memory) {
    bytes memory packed = abi.encodePacked(
      sender,
      receiver,
      uidType,
      expiresAt,
      address(uidContract),
      nonce,
      chainId
    );
    bytes32 digest = keccak256(packed);
    bytes32 ethSignedMessagePayload = digest.toEthSignedMessageHash();
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessagePayload);
    return abi.encodePacked(r, s, v);
  }

  event TransferSingle(
    address indexed _operator,
    address indexed _from,
    address indexed _to,
    uint256 _id,
    uint256 _value
  );
}
