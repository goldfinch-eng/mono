## UniqueIdentity

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xba0439088dc1e75F58e0A7C107627942C15cbb41

UniqueIdentity is an ERC1155-compliant contract for representing
the identity verification status of addresses.

### SIGNER_ROLE

```solidity
bytes32 SIGNER_ROLE
```

### ID_TYPE_0

```solidity
uint256 ID_TYPE_0
```

### ID_TYPE_1

```solidity
uint256 ID_TYPE_1
```

### ID_TYPE_2

```solidity
uint256 ID_TYPE_2
```

### ID_TYPE_3

```solidity
uint256 ID_TYPE_3
```

### ID_TYPE_4

```solidity
uint256 ID_TYPE_4
```

### ID_TYPE_5

```solidity
uint256 ID_TYPE_5
```

### ID_TYPE_6

```solidity
uint256 ID_TYPE_6
```

### ID_TYPE_7

```solidity
uint256 ID_TYPE_7
```

### ID_TYPE_8

```solidity
uint256 ID_TYPE_8
```

### ID_TYPE_9

```solidity
uint256 ID_TYPE_9
```

### ID_TYPE_10

```solidity
uint256 ID_TYPE_10
```

### MINT_COST_PER_TOKEN

```solidity
uint256 MINT_COST_PER_TOKEN
```

### nonces

```solidity
mapping(address => uint256) nonces
```

_We include a nonce in every hashed message, and increment the nonce as part of a
state-changing operation, so as to prevent replay attacks, i.e. the reuse of a signature._

### supportedUIDTypes

```solidity
mapping(uint256 => bool) supportedUIDTypes
```

### initialize

```solidity
function initialize(address owner, string uri) public
```

### __UniqueIdentity_init

```solidity
function __UniqueIdentity_init(address owner) internal
```

### __UniqueIdentity_init_unchained

```solidity
function __UniqueIdentity_init_unchained(address owner) internal
```

### setSupportedUIDTypes

```solidity
function setSupportedUIDTypes(uint256[] ids, bool[] values) public
```

### name

```solidity
function name() public pure returns (string)
```

_Gets the token name._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | string representing the token name |

### symbol

```solidity
function symbol() public pure returns (string)
```

_Gets the token symbol._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | string representing the token symbol |

### mint

```solidity
function mint(uint256 id, uint256 expiresAt, bytes signature) public payable
```

Mint a new UniqueIdentity token to the msgSender

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | uint256 | The id representing the KYC type of the UniqueIdentity |
| expiresAt | uint256 | The expiration time of the signature |
| signature | bytes | An EIP-191 signature of the corresponding mint params:                  account, id, expiresAt, address(this), nonces[account], block.chainid                  from an address with the SIGNER_ROLE. |

### mintTo

```solidity
function mintTo(address recipient, uint256 id, uint256 expiresAt, bytes signature) public payable
```

Mint a new UniqueIdentity token to the `recipient`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The recipient address to be minted to. |
| id | uint256 | The id representing the KYC type of the UniqueIdentity |
| expiresAt | uint256 | The expiration time of the signature |
| signature | bytes | An EIP-191 signature of the corresponding mintTo params:                  (account, recipient, id, expiresAt, address(this), nonces[account], block.chainid)                  from an address with the SIGNER_ROLE. |

### _mintTo

```solidity
function _mintTo(address mintToAddress, uint256 id) private
```

### burn

```solidity
function burn(address account, uint256 id, uint256 expiresAt, bytes signature) public
```

Burn a UniqueIdentity token of `id` from the `account`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account which currently owns the UID |
| id | uint256 | The id representing the KYC type of the UniqueIdentity |
| expiresAt | uint256 | The expiration time of the signature |
| signature | bytes | An EIP-191 signature of the corresponding burn params:                  (account, id, expiresAt, address(this), nonces[account], block.chainid)                  from an address with the SIGNER_ROLE. |

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address operator, address from, address to, uint256[] ids, uint256[] amounts, bytes data) internal
```

_See {ERC1155-_beforeTokenTransfer}.

Requirements:

- the contract must not be paused._

### onlySigner

```solidity
modifier onlySigner(address account, uint256 id, uint256 expiresAt, bytes signature)
```

### onlySignerMintTo

```solidity
modifier onlySignerMintTo(address mintToAddress, uint256 id, uint256 expiresAt, bytes signature)
```

### incrementNonce

```solidity
modifier incrementNonce(address account)
```

