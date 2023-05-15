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

### tokens

```solidity
mapping(uint256 => struct IPoolTokens.TokenInfo) tokens
```

### pools

```solidity
mapping(address => struct IPoolTokens.PoolInfo) pools
```

### royaltyParams

```solidity
struct ConfigurableRoyaltyStandard.RoyaltyParams royaltyParams
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
| tokenId | uint256 | tokenId The token ID (auto-incrementing integer across all pools) |

### redeem

```solidity
function redeem(uint256 tokenId, uint256 principalRedeemed, uint256 interestRedeemed) external virtual
```

Redeem principal and interest on a pool token. Called by valid pools as part of their redemption
 flow

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | pool token id |
| principalRedeemed | uint256 | principal to redeem. This cannot exceed the token's principal amount, and  the redemption cannot cause the pool's total principal redeemed to exceed the pool's total minted  principal |
| interestRedeemed | uint256 | interest to redeem. |

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

Withdraw a pool token's principal up to the token's principalAmount. Called by valid pools
 as part of their withdraw flow before the pool is locked (i.e. before the principal is committed)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | pool token id |
| principalAmount | uint256 | principal to withdraw |

### burn

```solidity
function burn(uint256 tokenId) external virtual
```

Burns a specific ERC721 token and removes deletes the token metadata for PoolTokens, BackerReards,
 and BackerStakingRewards

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | uint256 id of the ERC721 token to be burned. |

### getTokenInfo

```solidity
function getTokenInfo(uint256 tokenId) external view virtual returns (struct IPoolTokens.TokenInfo)
```

### getPoolInfo

```solidity
function getPoolInfo(address pool) external view returns (struct IPoolTokens.PoolInfo)
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

### splitToken

```solidity
function splitToken(uint256 tokenId, uint256 newPrincipal1) external returns (uint256 tokenId1, uint256 tokenId2)
```

Splits a pool token into two smaller positions. The original token is burned and all
its associated data is deleted.

_NA: Not Authorized
IA: Invalid Amount - newPrincipal1 not in range (0, principalAmount)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | id of the token to split. |
| newPrincipal1 | uint256 | principal amount for the first token in the split. The principal amount for the  second token in the split is implicitly the original token's principal amount less newPrincipal1 |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId1 | uint256 | id of the first token in the split |
| tokenId2 | uint256 | id of the second token in the split |

### _setBackerRewardsForSplitTokens

```solidity
function _setBackerRewardsForSplitTokens(struct IPoolTokens.TokenInfo tokenInfo, struct IBackerRewards.BackerRewardsTokenInfo backerRewardsTokenInfo, struct IBackerRewards.StakingRewardsTokenInfo stakingRewardsTokenInfo, uint256 newTokenId1, uint256 newTokenId2, uint256 newPrincipal1) internal
```

Initialize the backer rewards metadata for split tokens

### _createSplitTokens

```solidity
function _createSplitTokens(struct IPoolTokens.TokenInfo tokenInfo, address tokenOwner, uint256 newPrincipal1) internal returns (uint256 newTokenId1, uint256 newTokenId2)
```

Split tokenId into two new tokens. Assumes that newPrincipal1 is valid for the token's principalAmount

### validPool

```solidity
function validPool(address sender) public view virtual returns (bool)
```

Query if `pool` is a valid pool. A pool is valid if it was created by the Goldfinch Factory

### _createToken

```solidity
function _createToken(uint256 principalAmount, uint256 tranche, uint256 principalRedeemed, uint256 interestRedeemed, address poolAddress, address mintTo) internal returns (uint256 tokenId)
```

Mint the token and save its metadata to storage

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| principalAmount | uint256 | token principal |
| tranche | uint256 | tranche of the pool to which the token belongs |
| principalRedeemed | uint256 | amount of principal already redeemed for the token. This is  0 for tokens created from a deposit, and could be non-zero for tokens created from a split |
| interestRedeemed | uint256 | amount of interest already redeemed for the token. This is  0 for tokens created from a deposit, and could be non-zero for tokens created from a split |
| poolAddress | address | pool to which the token belongs |
| mintTo | address | the token owner |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | id of the created token |

### _destroyAndBurn

```solidity
function _destroyAndBurn(address owner, address pool, uint256 tokenId) internal
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

