## MerkleDirectDistributor

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x7766e86584069Cf5d1223323d89486e95d9a8C22

### gfi

```solidity
address gfi
```

Returns the address of the GFI contract that is the token distributed as rewards by
  this contract.

### merkleRoot

```solidity
bytes32 merkleRoot
```

Returns the merkle root of the merkle tree containing grant details available to accept.

### acceptedBitMap

```solidity
mapping(uint256 => uint256) acceptedBitMap
```

### initialize

```solidity
function initialize(address owner, address _gfi, bytes32 _merkleRoot) public
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
function acceptGrant(uint256 index, uint256 amount, bytes32[] merkleProof) external
```

Causes the sender to accept the grant consisting of the given details. Reverts if
the inputs (which includes who the sender is) are invalid.

