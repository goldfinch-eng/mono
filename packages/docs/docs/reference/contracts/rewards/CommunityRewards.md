## CommunityRewards

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x0Cd73c18C085dEB287257ED2307eC713e9Af3460

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### OWNER_ROLE

```solidity
bytes32 OWNER_ROLE
```

### DISTRIBUTOR_ROLE

```solidity
bytes32 DISTRIBUTOR_ROLE
```

### config

```solidity
contract GoldfinchConfig config
```

### rewardsAvailable

```solidity
uint256 rewardsAvailable
```

Total rewards available for granting, denominated in &#x60;rewardsToken()&#x60;

### tokenLaunchTimeInSeconds

```solidity
uint256 tokenLaunchTimeInSeconds
```

Token launch time in seconds. This is used in vesting.

### grants

```solidity
mapping(uint256 &#x3D;&gt; struct CommunityRewardsVesting.Rewards) grants
```

_NFT tokenId &#x3D;&gt; rewards grant_

### __initialize__

```solidity
function __initialize__(address owner, contract GoldfinchConfig _config, uint256 _tokenLaunchTimeInSeconds) external
```

### rewardsToken

```solidity
function rewardsToken() public view returns (contract IERC20withDec)
```

The token being disbursed as rewards

### claimableRewards

```solidity
function claimableRewards(uint256 tokenId) public view returns (uint256 rewards)
```

Returns the rewards claimable by a given grant token, taking into
  account vesting schedule.

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in &#x60;rewardsToken()&#x60; |

### totalVestedAt

```solidity
function totalVestedAt(uint256 start, uint256 end, uint256 granted, uint256 cliffLength, uint256 vestingInterval, uint256 revokedAt, uint256 time) external pure returns (uint256 rewards)
```

Returns the rewards that will have vested for some grant with the given params.

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | Amount of rewards denominated in &#x60;rewardsToken()&#x60; |

### loadRewards

```solidity
function loadRewards(uint256 rewards) external
```

Transfer rewards from msg.sender, to be used for reward distribution

### revokeGrant

```solidity
function revokeGrant(uint256 tokenId) external
```

Revokes rewards that have not yet vested, for a grant. The unvested rewards are
now considered available for allocation in another grant.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The tokenId corresponding to the grant whose unvested rewards to revoke. |

### setTokenLaunchTimeInSeconds

```solidity
function setTokenLaunchTimeInSeconds(uint256 _tokenLaunchTimeInSeconds) external
```

### grant

```solidity
function grant(address recipient, uint256 amount, uint256 vestingLength, uint256 cliffLength, uint256 vestingInterval) external returns (uint256 tokenId)
```

Grant rewards to a recipient. The recipient address receives an
  an NFT representing their rewards grant. They can present the NFT to &#x60;getReward()&#x60;
  to claim their rewards. Rewards vest over a schedule. If the given &#x60;vestingInterval&#x60;
  is 0, then &#x60;vestingInterval&#x60; will be equal to &#x60;vestingLength&#x60;.

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The recipient of the grant. |
| amount | uint256 | The amount of &#x60;rewardsToken()&#x60; to grant. |
| vestingLength | uint256 | The duration (in seconds) over which the grant vests. |
| cliffLength | uint256 | The duration (in seconds) from the start of the grant, before which has elapsed the vested amount remains 0. |
| vestingInterval | uint256 | The interval (in seconds) at which vesting occurs. |

### _grant

```solidity
function _grant(address recipient, uint256 amount, uint256 vestingLength, uint256 cliffLength, uint256 vestingInterval) internal returns (uint256 tokenId)
```

### getReward

```solidity
function getReward(uint256 tokenId) external
```

Claim rewards for a given grant

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A grant token ID |

### totalUnclaimed

```solidity
function totalUnclaimed(address owner) external view returns (uint256)
```

### unclaimed

```solidity
function unclaimed(uint256 tokenId) external view returns (uint256)
```

### _unclaimed

```solidity
function _unclaimed(uint256 tokenId) internal view returns (uint256)
```

### isAdmin

```solidity
function isAdmin() public view returns (bool)
```

### onlyAdmin

```solidity
modifier onlyAdmin()
```

### isDistributor

```solidity
function isDistributor() public view returns (bool)
```

### onlyDistributor

```solidity
modifier onlyDistributor()
```

