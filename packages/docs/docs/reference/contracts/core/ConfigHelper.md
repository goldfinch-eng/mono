## ConfigHelper

A convenience library for getting easy access to other contracts and constants within the
 protocol, through the use of the GoldfinchConfig contract

### getSeniorPool

```solidity
function getSeniorPool(contract GoldfinchConfig config) internal view returns (contract ISeniorPool)
```

### getSeniorPoolStrategy

```solidity
function getSeniorPoolStrategy(contract GoldfinchConfig config) internal view returns (contract ISeniorPoolStrategy)
```

### getUSDC

```solidity
function getUSDC(contract GoldfinchConfig config) internal view returns (contract IERC20withDec)
```

### getFidu

```solidity
function getFidu(contract GoldfinchConfig config) internal view returns (contract IFidu)
```

### getFiduUSDCCurveLP

```solidity
function getFiduUSDCCurveLP(contract GoldfinchConfig config) internal view returns (contract ICurveLP)
```

### getCUSDCContract

```solidity
function getCUSDCContract(contract GoldfinchConfig config) internal view returns (contract ICUSDCContract)
```

### getPoolTokens

```solidity
function getPoolTokens(contract GoldfinchConfig config) internal view returns (contract IPoolTokens)
```

### getBackerRewards

```solidity
function getBackerRewards(contract GoldfinchConfig config) internal view returns (contract IBackerRewards)
```

### getGoldfinchFactory

```solidity
function getGoldfinchFactory(contract GoldfinchConfig config) internal view returns (contract IGoldfinchFactory)
```

### getGFI

```solidity
function getGFI(contract GoldfinchConfig config) internal view returns (contract IERC20withDec)
```

### getGo

```solidity
function getGo(contract GoldfinchConfig config) internal view returns (contract IGo)
```

### getStakingRewards

```solidity
function getStakingRewards(contract GoldfinchConfig config) internal view returns (contract IStakingRewards)
```

### getTranchedPoolImplementationRepository

```solidity
function getTranchedPoolImplementationRepository(contract GoldfinchConfig config) internal view returns (contract ImplementationRepository)
```

### getCallableLoanImplementationRepository

```solidity
function getCallableLoanImplementationRepository(contract GoldfinchConfig config) internal view returns (contract ImplementationRepository)
```

### getWithdrawalRequestToken

```solidity
function getWithdrawalRequestToken(contract GoldfinchConfig config) internal view returns (contract IWithdrawalRequestToken)
```

### oneInchAddress

```solidity
function oneInchAddress(contract GoldfinchConfig config) internal view returns (address)
```

### creditLineImplementationAddress

```solidity
function creditLineImplementationAddress(contract GoldfinchConfig config) internal view returns (address)
```

### trustedForwarderAddress

```solidity
function trustedForwarderAddress(contract GoldfinchConfig config) internal view returns (address)
```

_deprecated because we no longer use GSN_

### configAddress

```solidity
function configAddress(contract GoldfinchConfig config) internal view returns (address)
```

### poolTokensAddress

```solidity
function poolTokensAddress(contract GoldfinchConfig config) internal view returns (address)
```

### backerRewardsAddress

```solidity
function backerRewardsAddress(contract GoldfinchConfig config) internal view returns (address)
```

### seniorPoolAddress

```solidity
function seniorPoolAddress(contract GoldfinchConfig config) internal view returns (address)
```

### seniorPoolStrategyAddress

```solidity
function seniorPoolStrategyAddress(contract GoldfinchConfig config) internal view returns (address)
```

### goldfinchFactoryAddress

```solidity
function goldfinchFactoryAddress(contract GoldfinchConfig config) internal view returns (address)
```

### gfiAddress

```solidity
function gfiAddress(contract GoldfinchConfig config) internal view returns (address)
```

### fiduAddress

```solidity
function fiduAddress(contract GoldfinchConfig config) internal view returns (address)
```

### fiduUSDCCurveLPAddress

```solidity
function fiduUSDCCurveLPAddress(contract GoldfinchConfig config) internal view returns (address)
```

### cusdcContractAddress

```solidity
function cusdcContractAddress(contract GoldfinchConfig config) internal view returns (address)
```

### usdcAddress

```solidity
function usdcAddress(contract GoldfinchConfig config) internal view returns (address)
```

### tranchedPoolAddress

```solidity
function tranchedPoolAddress(contract GoldfinchConfig config) internal view returns (address)
```

### reserveAddress

```solidity
function reserveAddress(contract GoldfinchConfig config) internal view returns (address)
```

### protocolAdminAddress

```solidity
function protocolAdminAddress(contract GoldfinchConfig config) internal view returns (address)
```

### borrowerImplementationAddress

```solidity
function borrowerImplementationAddress(contract GoldfinchConfig config) internal view returns (address)
```

### goAddress

```solidity
function goAddress(contract GoldfinchConfig config) internal view returns (address)
```

### stakingRewardsAddress

```solidity
function stakingRewardsAddress(contract GoldfinchConfig config) internal view returns (address)
```

### getReserveDenominator

```solidity
function getReserveDenominator(contract GoldfinchConfig config) internal view returns (uint256)
```

### getWithdrawFeeDenominator

```solidity
function getWithdrawFeeDenominator(contract GoldfinchConfig config) internal view returns (uint256)
```

### getLatenessGracePeriodInDays

```solidity
function getLatenessGracePeriodInDays(contract GoldfinchConfig config) internal view returns (uint256)
```

### getLatenessMaxDays

```solidity
function getLatenessMaxDays(contract GoldfinchConfig config) internal view returns (uint256)
```

### getDrawdownPeriodInSeconds

```solidity
function getDrawdownPeriodInSeconds(contract GoldfinchConfig config) internal view returns (uint256)
```

### getTransferRestrictionPeriodInDays

```solidity
function getTransferRestrictionPeriodInDays(contract GoldfinchConfig config) internal view returns (uint256)
```

### getLeverageRatio

```solidity
function getLeverageRatio(contract GoldfinchConfig config) internal view returns (uint256)
```

### getSeniorPoolWithdrawalCancelationFeeInBps

```solidity
function getSeniorPoolWithdrawalCancelationFeeInBps(contract GoldfinchConfig config) internal view returns (uint256)
```

