## MembershipVault

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x375B906B25E00bdD43017400CD4cefb36FBF9c18

Track assets held by owners in a vault, as well as the total held in the vault. Assets
 are not accounted for until the next epoch for MEV protection.

### ZeroAddressInvalid

```solidity
error ZeroAddressInvalid()
```

Thrown when depositing from address(0)

### NoTokensOwned

```solidity
error NoTokensOwned()
```

Thrown when trying to access tokens from an address with no tokens

### OneTokenPerAddress

```solidity
error OneTokenPerAddress()
```

Thrown when trying to access more than one token for an address

### IndexGreaterThanTokenSupply

```solidity
error IndexGreaterThanTokenSupply()
```

Thrown when querying token supply with an index greater than the supply

### NoTotalsInFutureEpochs

```solidity
error NoTotalsInFutureEpochs()
```

Thrown when checking totals in future epochs

### InvalidHoldingsAdjustment

```solidity
error InvalidHoldingsAdjustment(uint256 eligibleAmount, uint256 nextEpochAmount)
```

Thrown when adjusting holdings in an unsupported way

### NonexistantToken

```solidity
error NonexistantToken(uint256 tokenId)
```

Thrown when requesting a nonexistant token

### Checkpoint

```solidity
event Checkpoint(uint256 total)
```

The vault has been checkpointed

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| total | uint256 | how much is stored in the vault at the current block.timestamp |

### totalAmounts

```solidity
mapping(uint256 => uint256) totalAmounts
```

Totals by epoch. totalAmounts is always tracking past epochs, the current
  epoch, and the next epoch. There are a few cases:
  1. Checkpointing
     Noop for the same epoch. Checkpointing occurs before any mutative action
     so for new epochs, the last-set epoch value (totalAmounts[previousEpoch + 1])
     is copied to each epoch up to the current epoch + 1
  2. Increasing
     Checkpointing already occurred, so current epoch and next epoch
     are properly set up. Increasing just updates the next epoch value
  3. Decreasing
     Checkpointing already occurred like above. Decreasing updates the eligible
     and next epoch values

### checkpointEpoch

```solidity
uint256 checkpointEpoch
```

last epoch the vault was checkpointed

### positions

```solidity
mapping(uint256 => struct Position) positions
```

all positions held by the vault

### owners

```solidity
mapping(address => uint256) owners
```

owners and their position

### membershipIdsTracker

```solidity
uint256 membershipIdsTracker
```

counter tracking most current membership id

### baseURI

```solidity
string baseURI
```

base uri for the nft

### constructor

```solidity
constructor(contract Context _context) public
```

### initialize

```solidity
function initialize() public
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

_Returns the total amount of tokens stored by the contract._

### ownerOf

```solidity
function ownerOf(uint256 membershipId) external view returns (address owner)
```

### balanceOf

```solidity
function balanceOf(address owner) external view returns (uint256)
```

_Returns the number of tokens in ``owner``'s account._

### tokenOfOwnerByIndex

```solidity
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)
```

_Returns a token ID owned by `owner` at a given `index` of its token list.
Use along with {balanceOf} to enumerate all of ``owner``'s tokens._

### tokenByIndex

```solidity
function tokenByIndex(uint256 index) external view returns (uint256)
```

_Returns a token ID at a given `index` of all the tokens stored by the contract.
Use along with {totalSupply} to enumerate all tokens._

### supportsInterface

```solidity
function supportsInterface(bytes4 id) external pure returns (bool)
```

### name

```solidity
function name() external pure returns (string)
```

_Returns the token collection name._

### symbol

```solidity
function symbol() external pure returns (string)
```

_Returns the token collection symbol._

### tokenURI

```solidity
function tokenURI(uint256 tokenId) external view returns (string)
```

_Returns the Uniform Resource Identifier (URI) for `tokenId` token._

### setBaseURI

```solidity
function setBaseURI(string uri) external
```

Set the base uri for the contract

### currentValueOwnedBy

```solidity
function currentValueOwnedBy(address owner) external view returns (uint256)
```

Get the current value of `owner`. This changes depending on the current
 block.timestamp as increased holdings are not accounted for until the subsequent epoch.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address owning the positions |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | sum of all positions held by an address |

### currentTotal

```solidity
function currentTotal() external view returns (uint256)
```

Get the total value in the vault as of block.timestamp

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | total value in the vault as of block.timestamp |

### totalAtEpoch

```solidity
function totalAtEpoch(uint256 epoch) public view returns (uint256)
```

Get the total value in the vault as of epoch

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | total value in the vault as of epoch |

### positionOwnedBy

```solidity
function positionOwnedBy(address owner) external view returns (struct Position)
```

Get the position owned by `owner`

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Position | position owned by `owner` |

### adjustHoldings

```solidity
function adjustHoldings(address owner, uint256 eligibleAmount, uint256 nextEpochAmount) external returns (uint256)
```

Record an adjustment in holdings. Eligible assets will update this epoch and
 total assets will become eligible the subsequent epoch.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | the owner to checkpoint |
| eligibleAmount | uint256 | amount of points to apply to the current epoch |
| nextEpochAmount | uint256 | amount of points to apply to the next epoch |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | id of the position |

### checkpoint

```solidity
function checkpoint(address owner) external
```

Checkpoint a specific owner & the vault total

_to collect rewards, this must be called before `increaseHoldings` or
 `decreaseHoldings`. Those functions must call checkpoint internally
 so the historical data will be lost otherwise._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | the owner to checkpoint |

### _fetchOrCreateMembership

```solidity
function _fetchOrCreateMembership(address owner) private returns (uint256)
```

### _checkpoint

```solidity
function _checkpoint(address owner) private
```

