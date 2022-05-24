## Zapper

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd7b528e749078daDeE2f0071cde6fca4e191A521

Moves capital from the SeniorPool to TranchedPools without taking fees

### config

```solidity
contract GoldfinchConfig config
```

### Zap

```solidity
struct Zap {
  address owner;
  uint256 stakingPositionId;
}
```

### tranchedPoolZaps

```solidity
mapping(uint256 &#x3D;&gt; struct Zapper.Zap) tranchedPoolZaps
```

_PoolToken.id &#x3D;&gt; Zap_

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### zapStakeToTranchedPool

```solidity
function zapStakeToTranchedPool(uint256 tokenId, contract ITranchedPool tranchedPool, uint256 tranche, uint256 usdcAmount) public
```

Zap staked FIDU into the junior tranche of a TranchedPool without losing
  unvested rewards or paying a withdrawal fee

_The minted pool token is held by this contract until either &#x60;claimZap&#x60; or
  &#x60;unzap&#x60; is called_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| tranchedPool | contract ITranchedPool | A TranchedPool in which to deposit |
| tranche | uint256 | The tranche ID of tranchedPool in which to deposit |
| usdcAmount | uint256 | The amount in USDC to zap from StakingRewards into the TranchedPool |

### claimTranchedPoolZap

```solidity
function claimTranchedPoolZap(uint256 poolTokenId) public
```

Claim the underlying PoolToken for a zap initiated with &#x60;zapStakeToTranchePool&#x60;.
 The pool token will be transferred to msg.sender if msg.sender initiated the zap and
 we are past the tranche&#x27;s lockedUntil time.

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | The underyling PoolToken id created in a previously initiated zap |

### unzapToStakingRewards

```solidity
function unzapToStakingRewards(uint256 poolTokenId) public
```

Unwind a zap initiated with &#x60;zapStakeToTranchePool&#x60;.
 The funds will be withdrawn from the TranchedPool and added back to the original
 staked position in StakingRewards. This method can only be called when the PoolToken&#x27;s
 tranche has never been locked.

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | The underyling PoolToken id created in a previously initiated zap |

### zapStakeToCurve

```solidity
function zapStakeToCurve(uint256 tokenId, uint256 fiduAmount, uint256 usdcAmount) public
```

Zap staked FIDU into staked Curve LP tokens without losing unvested rewards
 or paying a withdrawal fee.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| fiduAmount | uint256 | The amount in FIDU from the staked position to zap |
| usdcAmount | uint256 | The amount of USDC to deposit into Curve |

### _hasAllowedUID

```solidity
function _hasAllowedUID(contract ITranchedPool pool) internal view returns (bool)
```

### _validPool

```solidity
function _validPool(contract ITranchedPool pool) internal view returns (bool)
```

