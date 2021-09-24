// SPDX-License-Identifier: GPL-3.0-only
// solhint-disable-next-line max-line-length
// Adapted from https://github.com/Uniswap/merkle-distributor/blob/c3255bfa2b684594ecd562cacd7664b0f18330bf/contracts/MerkleDistributor.sol.
pragma solidity 0.6.12;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

import "../interfaces/ICommunityRewards.sol";
import "../interfaces/IMerkleDistributor.sol";

contract MerkleDistributor is IMerkleDistributor {
  address public immutable override communityRewards;
  bytes32 public immutable override merkleRoot;

  // @dev This is a packed array of booleans.
  mapping(uint256 => uint256) private acceptedBitMap;

  constructor(address communityRewards_, bytes32 merkleRoot_) public {
    communityRewards = communityRewards_;
    merkleRoot = merkleRoot_;
  }

  function isGrantAccepted(uint256 index) public view override returns (bool) {
    uint256 acceptedWordIndex = index / 256;
    uint256 acceptedBitIndex = index % 256;
    uint256 acceptedWord = acceptedBitMap[acceptedWordIndex];
    uint256 mask = (1 << acceptedBitIndex);
    return acceptedWord & mask == mask;
  }

  function _setGrantAccepted(uint256 index) private {
    uint256 acceptedWordIndex = index / 256;
    uint256 acceptedBitIndex = index % 256;
    acceptedBitMap[acceptedWordIndex] = acceptedBitMap[acceptedWordIndex] | (1 << acceptedBitIndex);
  }

  function acceptGrant(
    uint256 index,
    address account,
    uint256 amount,
    uint256 vestingLength,
    uint256 cliffLength,
    uint256 vestingInterval,
    bytes32[] calldata merkleProof
  ) external override onlyGrantRecipient(account) {
    require(!isGrantAccepted(index), "MerkleDistributor: Grant already accepted.");

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(index, account, amount, vestingLength, cliffLength, vestingInterval));
    require(MerkleProof.verify(merkleProof, merkleRoot, node), "MerkleDistributor: Invalid proof.");

    // Mark it accepted and perform the granting.
    _setGrantAccepted(index);
    ICommunityRewards(communityRewards).grant(account, amount, vestingLength, cliffLength, vestingInterval);

    emit GrantAccepted(index, account, amount, vestingLength, cliffLength, vestingInterval);
  }

  modifier onlyGrantRecipient(address recipient) {
    require(msg.sender == recipient, "Only the grant recipient can accept a grant");
    _;
  }
}
