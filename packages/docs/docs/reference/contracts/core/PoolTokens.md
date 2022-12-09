## PoolTokens

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x57686612C601Cb5213b01AA8e80AfEb24BBd01df

PoolTokens is an ERC721 compliant contract, which can represent
 junior tranche or senior tranche shares of any of the borrower pools.

### _INTERFACE_ID_ERC721

```solidity
bytes4 _INTERFACE_ID_ERC721
```

### _INTERFACE_ID_ERC721_METADATA

```solidity
bytes4 _INTERFACE_ID_ERC721_METADATA
```

### _INTERFACE_ID_ERC721_ENUMERABLE

```solidity
bytes4 _INTERFACE_ID_ERC721_ENUMERABLE
```

### _INTERFACE_ID_ERC165

```solidity
bytes4 _INTERFACE_ID_ERC165
```

### config

```solidity
contract GoldfinchConfig config
```

### PoolInfo

```solidity
struct PoolInfo {
  uint256 totalMinted;
  uint256 totalPrincipalRedeemed;
  bool created;
}
```

### tokens

```solidity
mapping(uint256 => struct IPoolTokens.TokenInfo) tokens
```

### pools

```solidity
mapping(address => struct PoolTokens.PoolInfo) pools
```

### royaltyParams

```solidity
struct ConfigurableRoyaltyStandard.RoyaltyParams royaltyParams
```

### TokenMinted

```solidity
event TokenMinted(address owner, address pool, uint256 tokenId, uint256 amount, uint256 tranche)
```

### TokenRedeemed

```solidity
event TokenRedeemed(address owner, address pool, uint256 tokenId, uint256 principalRedeemed, uint256 interestRedeemed, uint256 tranche)
```

### TokenPrincipalWithdrawn

```solidity
event TokenPrincipalWithdrawn(address owner, address pool, uint256 tokenId, uint256 principalWithdrawn, uint256 tranche)
```

### TokenBurned

```solidity
event TokenBurned(address owner, address pool, uint256 tokenId)
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### RoyaltyParamsSet

```solidity
event RoyaltyParamsSet(address sender, address newReceiver, uint256 newRoyaltyPercent)
```

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config) external
```

### mint

```solidity
function mint(struct IPoolTokens.MintParams params, address to) external virtual returns (uint256 tokenId)
```

Called by pool to create a debt position in a particular tranche and amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IPoolTokens.MintParams | Struct containing the tranche and the amount |
| to | address | The address that should own the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID (auto-incrementing integer across all pools) |

### redeem

```solidity
function redeem(uint256 tokenId, uint256 principalRedeemed, uint256 interestRedeemed) external virtual
```

Updates a token to reflect the principal and interest amounts that have been redeemed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token id to update (must be owned by the pool calling this function) |
| principalRedeemed | uint256 | The incremental amount of principal redeemed (cannot be more than principal deposited) |
| interestRedeemed | uint256 | The incremental amount of interest redeemed |

### reducePrincipalAmount

```solidity
function reducePrincipalAmount(uint256 tokenId, uint256 amount) external
```

reduce a given pool token's principalAmount and principalRedeemed by a specified amount
 @dev uses safemath to prevent underflow
 @dev this function is only intended for use as part of the v2.6.0 upgrade
   to rectify a bug that allowed users to create a PoolToken that had a
   larger amount of principal than they actually made available to the
   borrower.  This bug is fixed in v2.6.0 but still requires past pool tokens
   to have their principal redeemed and deposited to be rectified.
 @param tokenId id of token to decrease
 @param amount amount to decrease by

### withdrawPrincipal

```solidity
function withdrawPrincipal(uint256 tokenId, uint256 principalAmount) external virtual
```

Decrement a token's principal amount. This is different from `redeem`, which captures changes to
  principal and/or interest that occur when a loan is in progress.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token id to update (must be owned by the pool calling this function) |
| principalAmount | uint256 | The incremental amount of principal redeemed (cannot be more than principal deposited) |

### burn

```solidity
function burn(uint256 tokenId) external virtual
```

_Burns a specific ERC721 token, and removes the data from our mappings_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | uint256 id of the ERC721 token to be burned. |

### getTokenInfo

```solidity
function getTokenInfo(uint256 tokenId) external view virtual returns (struct IPoolTokens.TokenInfo)
```

### onPoolCreated

```solidity
function onPoolCreated(address newPool) external
```

Called by the GoldfinchFactory to register the pool as a valid pool. Only valid pools can mint/redeem
tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPool | address | The address of the newly created pool |

### isApprovedOrOwner

```solidity
function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool)
```

Returns a boolean representing whether the spender is the owner or the approved spender of the token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The address to check |
| tokenId | uint256 | The token id to check for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if approved to redeem/transfer/burn the token, false if not |

### validPool

```solidity
function validPool(address sender) public view virtual returns (bool)
```

### _createToken

```solidity
function _createToken(struct IPoolTokens.MintParams params, address poolAddress) internal returns (uint256 tokenId)
```

### _destroyAndBurn

```solidity
function _destroyAndBurn(uint256 tokenId) internal
```

### _validPool

```solidity
function _validPool(address poolAddress) internal view virtual returns (bool)
```

### _getTokenInfo

```solidity
function _getTokenInfo(uint256 tokenId) internal view returns (struct IPoolTokens.TokenInfo)
```

### royaltyInfo

```solidity
function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view returns (address, uint256)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenId | uint256 | The NFT asset queried for royalty information |
| _salePrice | uint256 | The sale price of the NFT asset specified by _tokenId |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | receiver Address that should receive royalties |
| [1] | uint256 | royaltyAmount The royalty payment amount for _salePrice |

### setRoyaltyParams

```solidity
function setRoyaltyParams(address newReceiver, uint256 newRoyaltyPercent) external
```

Set royalty params used in `royaltyInfo`. This function is only callable by
  an address with `OWNER_ROLE`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newReceiver | address | The new address which should receive royalties. See `receiver`. |
| newRoyaltyPercent | uint256 | The new percent of `salePrice` that should be taken for royalties.   See `royaltyPercent`. |

### setBaseURI

```solidity
function setBaseURI(string baseURI_) external
```

### supportsInterface

```solidity
function supportsInterface(bytes4 id) public view returns (bool)
```

### onlyGoldfinchFactory

```solidity
modifier onlyGoldfinchFactory()
```

### onlyPool

```solidity
modifier onlyPool()
```

