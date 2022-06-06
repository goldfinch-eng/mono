## DynamicLeverageRatioStrategy

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x97b3F9653336Ab5388a0eF5F7cfE2BD84cf0f253

### LEVERAGE_RATIO_SETTER_ROLE

```solidity
bytes32 LEVERAGE_RATIO_SETTER_ROLE
```

### LeverageRatioInfo

```solidity
struct LeverageRatioInfo {
  uint256 leverageRatio;
  uint256 juniorTrancheLockedUntil;
}
```

### ratios

```solidity
mapping(address &#x3D;&gt; struct DynamicLeverageRatioStrategy.LeverageRatioInfo) ratios
```

### LeverageRatioUpdated

```solidity
event LeverageRatioUpdated(address pool, uint256 leverageRatio, uint256 juniorTrancheLockedUntil, bytes32 version)
```

### initialize

```solidity
function initialize(address owner) public
```

### getLeverageRatio

```solidity
function getLeverageRatio(contract ITranchedPool pool) public view returns (uint256)
```

### setLeverageRatio

```solidity
function setLeverageRatio(contract ITranchedPool pool, uint256 leverageRatio, uint256 juniorTrancheLockedUntil, bytes32 version) public
```

Updates the leverage ratio for the specified tranched pool. The combination of the
&#x60;juniorTranchedLockedUntil&#x60; param and the &#x60;version&#x60; param in the event emitted by this
function are intended to enable an outside observer to verify the computation of the leverage
ratio set by calls of this function.

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | The tranched pool whose leverage ratio to update. |
| leverageRatio | uint256 | The leverage ratio value to set for the tranched pool. |
| juniorTrancheLockedUntil | uint256 | The &#x60;lockedUntil&#x60; timestamp, of the tranched pool&#x27;s junior tranche, to which this calculation of &#x60;leverageRatio&#x60; corresponds, i.e. the value of the &#x60;lockedUntil&#x60; timestamp of the JuniorCapitalLocked event which the caller is calling this function in response to having observed. By providing this timestamp (plus an assumption that we can trust the caller to report this value accurately), the caller enables this function to enforce that a leverage ratio that is obsolete in the sense of having been calculated for an obsolete &#x60;lockedUntil&#x60; timestamp cannot be set. |
| version | bytes32 | An arbitrary identifier included in the LeverageRatioUpdated event emitted by this function, enabling the caller to describe how it calculated &#x60;leverageRatio&#x60;. Using the bytes32 type accommodates using git commit hashes (both the current SHA1 hashes, which require 20 bytes; and the future SHA256 hashes, which require 32 bytes) for this value. |

### onlySetterRole

```solidity
modifier onlySetterRole()
```

