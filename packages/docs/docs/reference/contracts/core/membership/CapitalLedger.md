## CapitalLedger

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x94e0bC3aedA93434B848C49752cfC58B1e7c5029

Track Capital held by owners and ensure the Capital has been accounted for.

### ZeroDeposit

```solidity
error ZeroDeposit()
```

Thrown when attempting to deposit nothing

### InvalidWithdrawAmount

```solidity
error InvalidWithdrawAmount(uint256 requested, uint256 max)
```

Thrown when withdrawing an invalid amount for a position

### InvalidOwnerIndex

```solidity
error InvalidOwnerIndex()
```

Thrown when depositing from address(0)

### IndexGreaterThanTokenSupply

```solidity
error IndexGreaterThanTokenSupply()
```

Thrown when querying token supply with an index greater than the supply

### Position

```solidity
struct Position {
  address owner;
  uint256 ownedIndex;
  address assetAddress;
  uint256 usdcEquivalent;
  uint256 depositTimestamp;
}
```

### ERC721Data

```solidity
struct ERC721Data {
  uint256 assetTokenId;
}
```

### positions

```solidity
mapping(uint256 => struct CapitalLedger.Position) positions
```

Data for positions in the vault. Always has a corresponding
entry at the same index in ERC20Data or ERC721 data, but never
both.

### owners

```solidity
mapping(address => uint256[]) owners
```

### totals

```solidity
mapping(address => struct UserEpochTotal) totals
```

Total held by each user, while being aware of the deposit epoch

### positionCounter

```solidity
uint256 positionCounter
```

### erc721Datas

```solidity
mapping(uint256 => struct CapitalLedger.ERC721Data) erc721Datas
```

ERC721 data corresponding to positions, data has the same index
as its corresponding position.

### constructor

```solidity
constructor(contract Context _context) public
```

Construct the contract

### depositERC721

```solidity
function depositERC721(address owner, address assetAddress, uint256 assetTokenId) external returns (uint256)
```

Account for a deposit of `id` for the ERC721 asset at `assetAddress`.

_reverts with InvalidAssetType if `assetAddress` is not an ERC721_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address that owns the position |
| assetAddress | address | address of the ERC20 address |
| assetTokenId | uint256 | id of the ERC721 asset to add |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | id of the newly created position |

### erc721IdOf

```solidity
function erc721IdOf(uint256 positionId) public view returns (uint256)
```

Get the id of the ERC721 asset held by position `id`. Pair this with
 `assetAddressOf` to get the address & id of the nft.

_reverts with InvalidAssetType if `assetAddress` is not an ERC721_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | id of the underlying ERC721 asset |

### withdraw

```solidity
function withdraw(uint256 positionId) external
```

Completely withdraw a position

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

### harvest

```solidity
function harvest(uint256 positionId) external
```

Harvests the associated rewards, interest, and other accrued assets
 associated with the asset token. For example, if given a PoolToken asset,
 this will collect the GFI rewards (if available), redeemable interest, and
 redeemable principal, and send that to the `owner`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

### assetAddressOf

```solidity
function assetAddressOf(uint256 positionId) public view returns (address)
```

Get the asset address of the position. Example: For an ERC721 position, this
 returns the address of that ERC721 contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | asset address of the position |

### ownerOf

```solidity
function ownerOf(uint256 positionId) public view returns (address)
```

Get the owner of a given position.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | owner of the position |

### totalsOf

```solidity
function totalsOf(address addr) external view returns (uint256 eligibleAmount, uint256 totalAmount)
```

Get the USDC value of `owner`s positions, reporting what is currently
 eligible and the total amount.

_this is used by Membership to determine how much is eligible in
 the current epoch vs the next epoch._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleAmount | uint256 | USDC value of positions eligible for rewards |
| totalAmount | uint256 | total USDC value of positions |

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

Total number of positions in the ledger

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | number of positions in the ledger |

### balanceOf

```solidity
function balanceOf(address addr) external view returns (uint256)
```

Get the number of capital positions held by an address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | positions held by address |

### tokenOfOwnerByIndex

```solidity
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)
```

Returns a position ID owned by `owner` at a given `index` of its position list

_use with {balanceOf} to enumerate all of `owner`'s positions_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | owner of the positions |
| index | uint256 | index of the owner's balance to get the position ID of |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | position id |

### tokenByIndex

```solidity
function tokenByIndex(uint256 index) external view returns (uint256)
```

_Returns a position ID at a given `index` of all the positions stored by the contract.
use with {totalSupply} to enumerate all positions_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | index to get the position ID at |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | position id |

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external pure returns (bytes4)
```

_Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
by `operator` from `from`, this function is called.

It must return its Solidity selector to confirm the token transfer.
If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.

The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`._

### _mintPosition

```solidity
function _mintPosition(address owner, address assetAddress, uint256 usdcEquivalent) private returns (uint256 positionId)
```

### _kick

```solidity
function _kick(uint256 positionId) internal
```

Update the USDC equivalent value of the position, based on the current,
 point-in-time valuation of the underlying asset.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

