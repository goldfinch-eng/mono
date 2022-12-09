## MembershipDirector

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x7E9140557F988d43c76caDab2fD392f9172ced21

### InvalidVaultPosition

```solidity
error InvalidVaultPosition()
```

### InvalidPositionType

```solidity
error InvalidPositionType()
```

### RewardsClaimed

```solidity
event RewardsClaimed(address owner, uint256 rewards)
```

Emitted when `owner` claims fidu `rewards`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | the owner claiming rewards |
| rewards | uint256 | amount of fidu claimed |

### constructor

```solidity
constructor(contract Context _context) public
```

### consumeHoldingsAdjustment

```solidity
function consumeHoldingsAdjustment(address owner) external returns (uint256)
```

Adjust an `owner`s membership score and position due to the change
 in their GFI and Capital holdings

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address who's holdings changed |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | id of membership position |

### collectRewards

```solidity
function collectRewards(address owner) external returns (uint256 rewards)
```

Collect all membership yield enhancements for the owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address to claim rewards for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | amount of yield enhancements collected |

### claimableRewards

```solidity
function claimableRewards(address owner) external view returns (uint256)
```

Check how many rewards are claimable for the owner. The return
 value here is how much would be retrieved by calling `collectRewards`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address to calculate claimable rewards for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the amount of rewards that could be claimed by the owner |

### currentScore

```solidity
function currentScore(address owner) external view returns (uint256 eligibleScore, uint256 totalScore)
```

Get the current score of `owner`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address to check the score of |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| eligibleScore | uint256 | score that is currently eligible for rewards |
| totalScore | uint256 | score that will be elgible for rewards next epoch |

### calculateMembershipScore

```solidity
function calculateMembershipScore(uint256 gfi, uint256 capital) public view returns (uint256)
```

Calculate the membership score

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| gfi | uint256 | Amount of gfi |
| capital | uint256 | Amount of capital in USDC |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | membership score |

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

### finalizeEpochs

```solidity
function finalizeEpochs() external
```

Finalize all unfinalized epochs. Causes the reserve splitter to distribute
 if there are unfinalized epochs so all possible rewards are distributed.

### _allocateRewards

```solidity
function _allocateRewards(address owner) private returns (uint256)
```

### _calculateRewards

```solidity
function _calculateRewards(uint256 startEpoch, uint256 eligibleMemberScore, uint256 nextEpochMemberScore) private view returns (uint256 rewards)
```

### _shareOfEpochRewards

```solidity
function _shareOfEpochRewards(uint256 epoch, uint256 memberScore) private view returns (uint256)
```

