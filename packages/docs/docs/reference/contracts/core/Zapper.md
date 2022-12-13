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
mapping(uint256 => struct Zapper.Zap) tranchedPoolZaps
```

_PoolToken.id => Zap_

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### zapMultipleToTranchedPool

```solidity
function zapMultipleToTranchedPool(uint256[] stakingRewardsTokenIds, uint256[] fiduAmounts, contract ITranchedPool tranchedPool, uint256 tranche) public returns (uint256[] poolTokenIds)
```

Zap multiple StakingRewards tokens to a tranched pool.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| stakingRewardsTokenIds | uint256[] | ids of the StakingRewards ERC721 positions to zap. Token ids MUST be   sorted ascending. |
| fiduAmounts | uint256[] | FIDU amount to zap for each position such that `fiduAmounts[i]` FIDU   is zapped from position `tokenIds[i]`. |
| tranchedPool | contract ITranchedPool | address of the tranched pool to zap into. |
| tranche | uint256 | id of the tranch to zap into. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenIds | uint256[] | PoolTokens ERC721 ids created by each zap action. |

### unzapMultipleFromTranchedPools

```solidity
function unzapMultipleFromTranchedPools(uint256[] poolTokenIds) public
```

Unzap multiple pool tokens (not necessarily from the same tranched pools).
  You may perform this action anytime before the respective tranche locks.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenIds | uint256[] | PoolTokens ERC721 ids to unzap. Token ids MUST be sorted ascending.   The caller MUST be the address that performed the initial zaps. |

### claimMultipleTranchedPoolZaps

```solidity
function claimMultipleTranchedPoolZaps(uint256[] poolTokenIds) public
```

Claim multiple pool tokens (not necessarily from the same tranched pools). A claim
  only succeeds if the tranched pool has locked.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenIds | uint256[] | PoolTokens ERC721 ids to claim. Token ids MUST be sorted ascending.   The caller MUST be the address that performed the initial zaps. |

### zapFiduStakeToTranchedPool

```solidity
function zapFiduStakeToTranchedPool(uint256 tokenId, contract ITranchedPool tranchedPool, uint256 tranche, uint256 fiduAmount) public returns (uint256 poolTokenId)
```

Zap staked FIDU into the junior tranche of a TranchedPool without losing
  unvested rewards or paying a withdrawal fee. This function is preferred over
  `zapStakeToTranchedPool` for zapping an entire position because the latter
  accepts a USDC amount, which cannot precisely represent FIDU due to lack of decimals.

_The minted pool token is held by this contract until either `claimZap` or
  `unzap` is called._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | StakingRewards ERC721 token id to zap. |
| tranchedPool | contract ITranchedPool | TranchedPool to deposit into. |
| tranche | uint256 | id of the tranche to deposit into. |
| fiduAmount | uint256 | amount to deposit in FIDU. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | PoolTokens ERC721 id of the TranchedPool deposit. |

### zapStakeToTranchedPool

```solidity
function zapStakeToTranchedPool(uint256 tokenId, contract ITranchedPool tranchedPool, uint256 tranche, uint256 usdcAmount) public returns (uint256 poolTokenId)
```

Zap staked FIDU into the junior tranche of a TranchedPool without losing
  unvested rewards or paying a withdrawal fee

_The minted pool token is held by this contract until either `claimZap` or
  `unzap` is called_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID. The owner MUST perform an ERC721 approval |
| tranchedPool | contract ITranchedPool | TranchedPool to deposit into. |
| tranche | uint256 | id of the tranche to deposit into. |
| usdcAmount | uint256 | The USDC amount to deposit. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | PoolTokens ERC721 id of the TranchedPool deposit.   for the Zapper address before calling this function. |

### claimTranchedPoolZap

```solidity
function claimTranchedPoolZap(uint256 poolTokenId) public
```

Claim the underlying PoolToken for a zap initiated with `zapStakeToTranchePool`.
 The pool token will be transferred to msg.sender if msg.sender initiated the zap and
 we are past the tranche's lockedUntil time.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | The underyling PoolToken id created in a previously initiated zap |

### unzapToStakingRewards

```solidity
function unzapToStakingRewards(uint256 poolTokenId) public
```

Unwind a zap initiated with `zapStakeToTranchePool`.
 The funds will be withdrawn from the TranchedPool and added back to the original
 staked position in StakingRewards. This method can only be called when the PoolToken's
 tranche has never been locked.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolTokenId | uint256 | The underyling PoolToken id created in a previously initiated zap |

### zapStakeToCurve

```solidity
function zapStakeToCurve(uint256 tokenId, uint256 fiduAmount, uint256 usdcAmount) public
```

Zap staked FIDU into staked Curve LP tokens without losing unvested rewards
 or paying a withdrawal fee.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | A staking position token ID |
| fiduAmount | uint256 | The amount in FIDU from the staked position to zap |
| usdcAmount | uint256 | The amount of USDC to deposit into Curve |

### _unzapToStakingRewards

```solidity
function _unzapToStakingRewards(uint256 poolTokenId) internal
```

See `unzapToStakingRewards`

### _claimTranchedPoolZap

```solidity
function _claimTranchedPoolZap(uint256 poolTokenId) internal
```

See `claimTranchedPoolZap`

### _zapUsdcAmountToTranchedPool

```solidity
function _zapUsdcAmountToTranchedPool(uint256 tokenId, contract ITranchedPool tranchedPool, uint256 tranche, uint256 usdcAmount) internal returns (uint256 poolTokenId)
```

See zapStakeToTranchedPool

### _zapFiduAmountToTranchedPool

```solidity
function _zapFiduAmountToTranchedPool(uint256 tokenId, contract ITranchedPool tranchedPool, uint256 tranche, uint256 fiduAmount) internal returns (uint256 poolTokenId)
```

See zapFiduStakeToTranchedPool

### _hasAllowedUID

```solidity
function _hasAllowedUID(contract ITranchedPool pool) internal view returns (bool)
```

### _validPool

```solidity
function _validPool(contract ITranchedPool pool) internal view returns (bool)
```

