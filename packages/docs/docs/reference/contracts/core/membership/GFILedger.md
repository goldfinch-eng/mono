## GFILedger

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xbc1081885da00404bd0108B70EC5aC0dbe98A077

Track GFI held by owners and ensure the GFI has been accounted for.

### ZeroDepositAmount

```solidity
error ZeroDepositAmount()
```

Thrown when depositing zero GFI for a position

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

### positions

```solidity
mapping(uint256 => struct IGFILedger.Position) positions
```

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

### constructor

```solidity
constructor(contract Context _context) public
```

Construct the contract

### deposit

```solidity
function deposit(address owner, uint256 amount) external returns (uint256 positionId)
```

Account for a new deposit by the owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address to account for the deposit |
| amount | uint256 | how much was deposited |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | how much was deposited |

### withdraw

```solidity
function withdraw(uint256 positionId) external returns (uint256)
```

Account for a new withdraw by the owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how much was withdrawn |

### withdraw

```solidity
function withdraw(uint256 positionId, uint256 amount) external returns (uint256)
```

Account for a new withdraw by the owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionId | uint256 | id of the position |
| amount | uint256 | how much to withdraw |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how much was withdrawn |

### balanceOf

```solidity
function balanceOf(address addr) external view returns (uint256 balance)
```

Get the number of GFI positions held by an address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 | positions held by address |

### ownerOf

```solidity
function ownerOf(uint256 positionId) external view returns (address)
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

Get amount of GFI of `owner`s positions, reporting what is currently
 eligible and the total amount.

_this is used by Membership to determine how much is eligible in
 the current epoch vs the next epoch._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleAmount | uint256 | GFI amount of positions eligible for rewards |
| totalAmount | uint256 | total GFI amount of positions |

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

Total number of positions in the ledger

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | number of positions in the ledger |

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
| [0] | uint256 | token id |

### _mintPosition

```solidity
function _mintPosition(address owner, uint256 amount) private returns (uint256 positionId)
```

### _withdraw

```solidity
function _withdraw(uint256 positionId) private returns (uint256)
```

