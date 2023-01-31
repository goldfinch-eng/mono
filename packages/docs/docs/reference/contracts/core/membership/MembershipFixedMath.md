## MembershipFixedMath

### InvalidFraction

```solidity
error InvalidFraction(uint256 n, uint256 d)
```

### toFixed

```solidity
function toFixed(uint256 n, uint256 d) internal pure returns (int256)
```

Convert some uint256 fraction `n` numerator / `d` denominator to a fixed-point number `f`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| n | uint256 | numerator |
| d | uint256 | denominator |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 | fixed-point number |

### uintDiv

```solidity
function uintDiv(uint256 u, int256 f) internal pure returns (uint256)
```

Divide some unsigned int `u` by a fixed point number `f`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| u | uint256 | unsigned dividend |
| f | int256 | fixed point divisor, in FIXED_1 units |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | unsigned int quotient |

### uintMul

```solidity
function uintMul(uint256 u, int256 f) internal pure returns (uint256)
```

Multiply some unsigned int `u` by a fixed point number `f`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| u | uint256 | unsigned multiplicand |
| f | int256 | fixed point multiplier, in FIXED_1 units |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | unsigned int product |

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

see FixedMath0x

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

see FixedMath0x

