## CapitalAssets

### InvalidAsset

```solidity
error InvalidAsset(address assetAddress)
```

Thrown when an asset has been requested that does not exist

### InvalidAssetWithId

```solidity
error InvalidAssetWithId(address assetAddress, uint256 assetTokenId)
```

Thrown when an asset has been requested that does not exist

### getSupportedType

```solidity
function getSupportedType(contract Context context, address assetAddress) internal view returns (enum CapitalAssetType)
```

Check if a specific `assetAddress` has a corresponding capital asset
 implementation and returns the asset type. Returns INVALID if no
 such asset exists.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| assetAddress | address | the address of the asset's contract |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum CapitalAssetType | type of the asset |

### isValid

```solidity
function isValid(contract Context context, address assetAddress, uint256 assetTokenId) internal view returns (bool)
```

Check if a specific token for a supported asset is valid or not. Returns false
 if the asset is not supported or the token is invalid

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| assetAddress | address | the address of the asset's contract |
| assetTokenId | uint256 | the token id |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether or not a specific token id of asset address is supported |

### getUsdcEquivalent

```solidity
function getUsdcEquivalent(contract Context context, contract IERC721Upgradeable asset, uint256 assetTokenId) internal view returns (uint256)
```

Get the point-in-time USDC equivalent value of the ERC721 asset. This
 specifically attempts to return the "principle" or "at-risk" USDC value of
 the asset and does not include rewards, interest, or other benefits.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| asset | contract IERC721Upgradeable | ERC721 to evaluate |
| assetTokenId | uint256 | id of the token to evaluate |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | USDC equivalent value |

### harvest

```solidity
function harvest(contract Context context, address owner, contract IERC721Upgradeable asset, uint256 assetTokenId) internal
```

Harvests the associated rewards, interest, and other accrued assets
 associated with the asset token. For example, if given a PoolToken asset,
 this will collect the GFI rewards (if available), redeemable interest, and
 redeemable principal, and send that to the `owner`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| owner | address | address to send the harvested assets to |
| asset | contract IERC721Upgradeable | ERC721 to harvest |
| assetTokenId | uint256 | id of the token to harvest |

