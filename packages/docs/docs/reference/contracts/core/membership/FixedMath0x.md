## FixedMath0x

### LnTooLarge

```solidity
error LnTooLarge(int256 x)
```

Thrown when the natural log function is given too large of an argument

### LnNonRealResult

```solidity
error LnNonRealResult(int256 x)
```

Thrown when the natural log would have returned a number outside of ℝ

### ExpTooLarge

```solidity
error ExpTooLarge(int256 x)
```

Thrown when exp is given too large of an argument

### UnsignedValueTooLarge

```solidity
error UnsignedValueTooLarge(uint256 x)
```

Thrown when an unsigned value is too large to be converted to a signed value

### FIXED_1

```solidity
int256 FIXED_1
```

### LN_MAX_VAL

```solidity
int256 LN_MAX_VAL
```

### LN_MIN_VAL

```solidity
int256 LN_MIN_VAL
```

### EXP_MAX_VAL

```solidity
int256 EXP_MAX_VAL
```

### EXP_MIN_VAL

```solidity
int256 EXP_MIN_VAL
```

### ln

```solidity
function ln(int256 x) internal pure returns (int256 r)
```

_Get the natural logarithm of a fixed-point number 0 < `x` <= LN_MAX_VAL_

### exp

```solidity
function exp(int256 x) internal pure returns (int256 r)
```

_Compute the natural exponent for a fixed-point number EXP_MIN_VAL <= `x` <= 1_

