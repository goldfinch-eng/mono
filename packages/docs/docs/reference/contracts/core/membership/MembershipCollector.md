## MembershipCollector

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x5ccFa5fec4Db2543D3995DC5419a13b6e99eA7A1

Responsible for receiving USDC from ERC20Splitter, using it to acquire fidu, and allocating
  it to epochs, where it can be claimed by membership participants.

### InvalidReceiveCaller

```solidity
error InvalidReceiveCaller()
```

### EpochFinalized

```solidity
event EpochFinalized(uint256 epoch, uint256 totalRewards)
```

Emitted once `epoch` has been finalized and will no longer change

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| epoch | uint256 | epoch that is now finalized |
| totalRewards | uint256 | all of the rewards in that epoch |

### lastCheckpointAt

```solidity
uint256 lastCheckpointAt
```

The last block.timestamp when epochs were finalized. The last
  finalized epoch is the most recent epoch that ends before lastCheckpointAt.

### rewardsForEpoch

```solidity
mapping(uint256 => uint256) rewardsForEpoch
```

A mapping of epochs to fidu reward amounts

### firstRewardEpoch

```solidity
uint256 firstRewardEpoch
```

The first epoch rewards should be provided in

### constructor

```solidity
constructor(contract Context _context, uint256 _firstRewardEpoch) public
```

### onReceive

```solidity
function onReceive(uint256 amount) external returns (bytes4)
```

Receive handler for the reserve ERC20Splitter. This handler uses the USDC
  amount it has received to acquire fidu from the senior pool and distribute it across
  epochs that have elapsed since the last distribution. The fidu rewards are distributed
  proportionaly across epochs based on their portion of total elapsed time. Once an epoch
  has passed, it is consider "finalized" and no longer considered for future runs of this
  function.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | USDC reward amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | The 4 byte selector required by IERC20SplitterReceiver |

### finalizeEpochs

```solidity
function finalizeEpochs() external
```

Finalize all unfinalized epochs. Causes the reserve splitter to distribute
 if there are unfinalized epochs so all possible rewards are distributed.

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

### distributeFiduTo

```solidity
function distributeFiduTo(address addr, uint256 amount) external
```

Have the collector distribute `amount` of Fidu to `addr`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address to distribute to |
| amount | uint256 | amount to distribute |

### allocateToElapsedEpochs

```solidity
function allocateToElapsedEpochs(uint256 fiduAmount) internal
```

### lastFinalizedEpoch

```solidity
function lastFinalizedEpoch() public view returns (uint256)
```

The last epoch whose rewards should be considered finalized and ready to be claimed

