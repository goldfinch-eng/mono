## MembershipScores

### GFI_MANTISSA

```solidity
uint256 GFI_MANTISSA
```

### USDC_MANTISSA

```solidity
uint256 USDC_MANTISSA
```

### USDC_TO_GFI_MANTISSA

```solidity
uint256 USDC_TO_GFI_MANTISSA
```

### calculateScore

```solidity
function calculateScore(uint256 gfi, uint256 capital, uint256 alphaNumerator, uint256 alphaDenominator) internal pure returns (uint256)
```

Calculate a membership score given some amount of `gfi` and `capital`, along
 with some 𝝰 = `alphaNumerator` / `alphaDenominator`.

_𝝰 must be in the range [0, 1]_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| gfi | uint256 | amount of gfi (GFI, 1e18 decimal places) |
| capital | uint256 | amount of capital (USDC, 1e6 decimal places) |
| alphaNumerator | uint256 | alpha param numerator |
| alphaDenominator | uint256 | alpha param denominator |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | membership score with 1e18 decimal places |

