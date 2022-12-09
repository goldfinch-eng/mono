## MembershipLedger

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xe9C893abDCDb0F710C0CEA8c70094f9E751eEe3c

### InvalidAlphaGTE1

```solidity
error InvalidAlphaGTE1()
```

### InvalidAlphaUndefined

```solidity
error InvalidAlphaUndefined()
```

### InvalidAlphaNumerator

```solidity
error InvalidAlphaNumerator()
```

### InvalidAlphaDenominator

```solidity
error InvalidAlphaDenominator()
```

### Fraction

```solidity
struct Fraction {
  uint128 numerator;
  uint128 denominator;
}
```

### allocatedRewards

```solidity
mapping(address => uint256) allocatedRewards
```

rewards allocated to and not yet claimed by an address

### alpha

```solidity
struct MembershipLedger.Fraction alpha
```

Alpha param for the cobb douglas function

### constructor

```solidity
constructor(contract Context _context) public
```

Construct the contract

### initialize

```solidity
function initialize() public
```

### resetRewards

```solidity
function resetRewards(address addr) external
```

Set `addr`s allocated rewards back to 0

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address to reset rewards on |

### allocateRewardsTo

```solidity
function allocateRewardsTo(address addr, uint256 amount) external returns (uint256 rewards)
```

Allocate `amount` rewards for `addr` but do not send them

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address to distribute rewards to |
| amount | uint256 | amount of rewards to allocate for `addr` |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | total allocated to `addr` |

### getPendingRewardsFor

```solidity
function getPendingRewardsFor(address addr) external view returns (uint256 rewards)
```

Get the rewards allocated to a certain `addr`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | the address to check pending rewards for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewards | uint256 | pending rewards for `addr` |

### setAlpha

```solidity
function setAlpha(uint128 numerator, uint128 denominator) external
```

Set the alpha parameter used in the membership score formula. Alpha is defined as a fraction in
 the range (0, 1) and constrained to (0,20) / (0,20], so a minimum of 1/20 and a maximum of 19/20.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| numerator | uint128 | the numerator of the fraction, must be in the range (0, 20) |
| denominator | uint128 | the denominator of the fraction, must be in the range (0, 20] and greater than the numerator |

