## MerkleDistributor

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x0f306E3f6b2d5ae820d33C284659B29847972d9A

### communityRewards

```solidity
address communityRewards
```

Returns the address of the CommunityRewards contract whose grants are distributed by this contract.

### merkleRoot

```solidity
bytes32 merkleRoot
```

Returns the merkle root of the merkle tree containing grant details available to accept.

### acceptedBitMap

```solidity
mapping(uint256 &#x3D;&gt; uint256) acceptedBitMap
```

### constructor

```solidity
constructor(address communityRewards_, bytes32 merkleRoot_) public
```

### isGrantAccepted

```solidity
function isGrantAccepted(uint256 index) public view returns (bool)
```

Returns true if the index has been marked accepted.

### _setGrantAccepted

```solidity
function _setGrantAccepted(uint256 index) private
```

### acceptGrant

```solidity
function acceptGrant(uint256 index, uint256 amount, uint256 vestingLength, uint256 cliffLength, uint256 vestingInterval, bytes32[] merkleProof) external
```

Causes the sender to accept the grant consisting of the given details. Reverts if
the inputs (which includes who the sender is) are invalid.

