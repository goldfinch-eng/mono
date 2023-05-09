## StakedFiduAsset

### AssetType

```solidity
enum CapitalAssetType AssetType
```

### isType

```solidity
function isType(contract Context context, address assetAddress) internal view returns (bool)
```

Get the type of asset that this contract adapts.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | the asset type |

### isValid

```solidity
function isValid(contract Context context, uint256 assetTokenId) internal view returns (bool)
```

Get whether or not the given asset is valid

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if the asset is Fidu type (not CurveLP) |

### getUsdcEquivalent

```solidity
function getUsdcEquivalent(contract Context context, uint256 assetTokenId) internal view returns (uint256)
```

Get the point-in-time USDC equivalent value of the ERC721 asset. This
 specifically attempts to return the "principle" or "at-risk" USDC value of
 the asset and does not include rewards, interest, or other benefits.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| assetTokenId | uint256 | id of the position to evaluate |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | USDC equivalent value |

### harvest

```solidity
function harvest(contract Context context, address owner, uint256 assetTokenId) internal
```

Harvest GFI rewards on a staked fidu token and send them to `owner`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| context | contract Context | goldfinch context for routing |
| owner | address | address to send the GFI to |
| assetTokenId | uint256 | id of the position to harvest |

