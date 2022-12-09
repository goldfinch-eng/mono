## ERC721NonTransferable

A abstract registry of NFTs that only allows reading the NFTs and nothing
        else (no minting, transferring, etc). This acts as a "view" into some set
        of NFTs that may not otherwise adhere to the ERC721 standard.

_See `Transfer Mechanism` in the following link for the inspiration
     behind this class: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md#rationale_

### ReadOnly

```solidity
error ReadOnly()
```

### safeTransferFrom

```solidity
function safeTransferFrom(address, address, uint256) external pure
```

### transferFrom

```solidity
function transferFrom(address, address, uint256) external pure
```

### approve

```solidity
function approve(address, uint256) external pure
```

### getApproved

```solidity
function getApproved(uint256) external pure returns (address)
```

### setApprovalForAll

```solidity
function setApprovalForAll(address, bool) external pure
```

### isApprovedForAll

```solidity
function isApprovedForAll(address, address) external pure returns (bool)
```

### safeTransferFrom

```solidity
function safeTransferFrom(address, address, uint256, bytes) external pure
```

