## MembershipOrchestrator

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x4E5d9B093986D864331d88e0a13a616e1D508838

Externally facing gateway to all Goldfinch membership functionality.

### UnsupportedAssetAddress

```solidity
error UnsupportedAssetAddress(address addr)
```

Thrown when anything is called with an unsupported asset

### RequiresValidInput

```solidity
error RequiresValidInput()
```

Thrown when calling a method with invalid input

### CannotOperateOnUnownedAsset

```solidity
error CannotOperateOnUnownedAsset(address nonOwner)
```

Thrown when operating on an unowned asset

### constructor

```solidity
constructor(contract Context _context) public
```

### initialize

```solidity
function initialize() external
```

Initialize the contract

### deposit

```solidity
function deposit(struct Deposit depositData) external returns (struct DepositResult result)
```

Deposit multiple assets defined in `multiDeposit`. Assets can include GFI, Staked Fidu,
 and others.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositData | struct Deposit |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| result | struct DepositResult | ids all of the ids of the created depoits, in the same order as deposit. If GFI is  present, it will be the first id. |

### withdraw

```solidity
function withdraw(struct Withdrawal withdrawal) external
```

Withdraw multiple assets defined in `multiWithdraw`. Assets can be GFI or capital
 positions ids. Caller must have been permitted to act upon all of the positions.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawal | struct Withdrawal | all of the GFI and Capital ids to withdraw |

### collectRewards

```solidity
function collectRewards() external returns (uint256)
```

Collect all membership rewards for the caller.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how many rewards were collected and sent to caller |

### harvest

```solidity
function harvest(uint256[] capitalPositionIds) external
```

Harvest the rewards, interest, redeemable principal, or other assets
 associated with the underlying capital asset. For example, if given a PoolToken,
 this will collect the GFI rewards (if available), redeemable interest, and
 redeemable principal, and send that to the owner of the capital position.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| capitalPositionIds | uint256[] | id of the capital position to harvest the underlying asset of |

### claimableRewards

```solidity
function claimableRewards(address addr) external view returns (uint256)
```

Check how many rewards are claimable at this moment in time for caller.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the address to check claimable rewards for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | how many rewards could be claimed by a call to `collectRewards` |

### votingPower

```solidity
function votingPower(address addr) external view returns (uint256)
```

Check the voting power of a given address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the address to check the voting power of |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the voting power |

### totalGFIHeldBy

```solidity
function totalGFIHeldBy(address addr) external view returns (uint256 eligibleAmount, uint256 totalAmount)
```

Get all GFI in Membership held by `addr`. This returns the current eligible amount and the
 total amount of GFI.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the owner |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleAmount | uint256 | how much GFI is currently eligible for rewards |
| totalAmount | uint256 | how much GFI is currently eligible for rewards |

### totalCapitalHeldBy

```solidity
function totalCapitalHeldBy(address addr) external view returns (uint256 eligibleAmount, uint256 totalAmount)
```

Get all capital, denominated in USDC, in Membership held by `addr`. This returns the current
 eligible amount and the total USDC value of capital.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the owner |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleAmount | uint256 | how much USDC of capital is currently eligible for rewards |
| totalAmount | uint256 | how much  USDC of capital is currently eligible for rewards |

### memberScoreOf

```solidity
function memberScoreOf(address addr) external view returns (uint256 eligibleScore, uint256 totalScore)
```

Get the member score of `addr`

_if eligibleScore == totalScore then there are no changes between now and the next epoch_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the owner |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleScore | uint256 | the currently eligible score |
| totalScore | uint256 | the total score that will be eligible next epoch |

### estimateRewardsFor

```solidity
function estimateRewardsFor(uint256 epoch) external view returns (uint256)
```

Estimate rewards for a given epoch. For epochs at or before lastFinalizedEpoch
 this will be the fixed, accurate reward for the epoch. For the current and other
 non-finalized epochs, this will be the value as if the epoch were finalized in that
 moment.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| epoch | uint256 | epoch to estimate the rewards of |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | rewards associated with `epoch` |

### calculateMemberScore

```solidity
function calculateMemberScore(uint256 gfi, uint256 capital) external view returns (uint256)
```

Calculate what the Membership Score would be if a `gfi` amount of GFI and `capital` amount
 of Capital denominated in USDC were deposited.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| gfi | uint256 | amount of GFI to estimate with |
| capital | uint256 | amount of capital to estimate with, denominated in USDC |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### finalizeEpochs

```solidity
function finalizeEpochs() external
```

Finalize all unfinalized epochs. Causes the reserve splitter to distribute
 if there are unfinalized epochs so all possible rewards are distributed.

### estimateMemberScore

```solidity
function estimateMemberScore(address memberAddress, int256 gfi, int256 capital) external view returns (uint256 score)
```

Estimate the score for an existing member, given some changes in GFI and capital

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| memberAddress | address | the member's address |
| gfi | int256 | the change in gfi holdings, denominated in GFI |
| capital | int256 | the change in gfi holdings, denominated in USDC |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| score | uint256 | resulting score for the member given the GFI and capital changes |

### totalMemberScores

```solidity
function totalMemberScores() external view returns (uint256 eligibleTotal, uint256 nextEpochTotal)
```

Get the sum of all member scores that are currently eligible and that will be eligible next epoch

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleTotal | uint256 | sum of all member scores that are currently eligible |
| nextEpochTotal | uint256 | sum of all member scores that will be eligible next epoch |

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external pure returns (bytes4)
```

_Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
by `operator` from `from`, this function is called.

It must return its Solidity selector to confirm the token transfer.
If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.

The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`._

### _depositGFI

```solidity
function _depositGFI(uint256 amount) private returns (uint256)
```

### _depositCapitalERC721

```solidity
function _depositCapitalERC721(address assetAddress, uint256 id) private returns (uint256)
```

### _withdrawGFI

```solidity
function _withdrawGFI(uint256 positionId) private returns (uint256)
```

### _withdrawGFI

```solidity
function _withdrawGFI(uint256 positionId, uint256 amount) private returns (uint256)
```

### _withdrawCapital

```solidity
function _withdrawCapital(uint256 positionId) private
```

