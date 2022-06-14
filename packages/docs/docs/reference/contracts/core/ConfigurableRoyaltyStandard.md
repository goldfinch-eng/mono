## ConfigurableRoyaltyStandard

Library to house logic around the ERC2981 royalty standard. Contracts
  using this library should define a ConfigurableRoyaltyStandard.RoyaltyParams
  state var and public functions that proxy to the logic here. Contracts should
  take care to ensure that a public &#x60;setRoyaltyParams&#x60; method is only callable
  by an admin.

### _INTERFACE_ID_ERC2981

```solidity
bytes4 _INTERFACE_ID_ERC2981
```

_bytes4(keccak256(&quot;royaltyInfo(uint256,uint256)&quot;)) &#x3D;&#x3D; 0x2a55205a_

### _PERCENTAGE_DECIMALS

```solidity
uint256 _PERCENTAGE_DECIMALS
```

### RoyaltyParams

```solidity
struct RoyaltyParams {
  address receiver;
  uint256 royaltyPercent;
}
```

### RoyaltyParamsSet

```solidity
event RoyaltyParamsSet(address sender, address newReceiver, uint256 newRoyaltyPercent)
```

### royaltyInfo

```solidity
function royaltyInfo(struct ConfigurableRoyaltyStandard.RoyaltyParams params, uint256 _tokenId, uint256 _salePrice) internal view returns (address, uint256)
```

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ConfigurableRoyaltyStandard.RoyaltyParams |  |
| _tokenId | uint256 | The NFT asset queried for royalty information |
| _salePrice | uint256 | The sale price of the NFT asset specified by _tokenId |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | receiver Address that should receive royalties |
| [1] | uint256 | royaltyAmount The royalty payment amount for _salePrice |

### setRoyaltyParams

```solidity
function setRoyaltyParams(struct ConfigurableRoyaltyStandard.RoyaltyParams params, address newReceiver, uint256 newRoyaltyPercent) internal
```

Set royalty params used in &#x60;royaltyInfo&#x60;. The calling contract should limit
  public use of this function to owner or using some other access control scheme.

_The receiver cannot be the null address_

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ConfigurableRoyaltyStandard.RoyaltyParams |  |
| newReceiver | address | The new address which should receive royalties. See &#x60;receiver&#x60;. |
| newRoyaltyPercent | uint256 | The new percent of &#x60;salePrice&#x60; that should be taken for royalties.   See &#x60;royaltyPercent&#x60;. |

