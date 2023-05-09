## CreditDesk

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xD52dc1615c843c30F2e4668E101c0938e6007220

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xD52dc1615c843c30F2e4668E101c0938e6007220

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xD52dc1615c843c30F2e4668E101c0938e6007220

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xD52dc1615c843c30F2e4668E101c0938e6007220

Main entry point for borrowers and underwriters.
 Handles key logic for creating CreditLine&#x27;s, borrowing money, repayment, etc.

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### config

```solidity
contract GoldfinchConfig config
```

### Underwriter

```solidity
struct Underwriter {
  uint256 governanceLimit;
  address[] creditLines;
}
```

### Borrower

```solidity
struct Borrower {
  address[] creditLines;
}
```

### PaymentApplied

```solidity
event PaymentApplied(address payer, address creditLine, uint256 interestAmount, uint256 principalAmount, uint256 remainingAmount)
```

### PaymentCollected

```solidity
event PaymentCollected(address payer, address creditLine, uint256 paymentAmount)
```

### DrawdownMade

```solidity
event DrawdownMade(address borrower, address creditLine, uint256 drawdownAmount)
```

### CreditLineCreated

```solidity
event CreditLineCreated(address borrower, address creditLine)
```

### GovernanceUpdatedUnderwriterLimit

```solidity
event GovernanceUpdatedUnderwriterLimit(address underwriter, uint256 newLimit)
```

### underwriters

```solidity
mapping(address &#x3D;&gt; struct CreditDesk.Underwriter) underwriters
```

### borrowers

```solidity
mapping(address &#x3D;&gt; struct CreditDesk.Borrower) borrowers
```

### creditLines

```solidity
mapping(address &#x3D;&gt; address) creditLines
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

Run only once, on initialization

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address of who should have the &quot;OWNER_ROLE&quot; of this contract |
| _config | contract GoldfinchConfig | The address of the GoldfinchConfig contract |

### setUnderwriterGovernanceLimit

```solidity
function setUnderwriterGovernanceLimit(address underwriterAddress, uint256 limit) external
```

Sets a particular underwriter&#x27;s limit of how much credit the DAO will allow them to &quot;create&quot;

| Name | Type | Description |
| ---- | ---- | ----------- |
| underwriterAddress | address | The address of the underwriter for whom the limit shall change |
| limit | uint256 | What the new limit will be set to Requirements: - the caller must have the &#x60;OWNER_ROLE&#x60;. |

### drawdown

```solidity
function drawdown(address creditLineAddress, uint256 amount) external
```

Allows a borrower to drawdown on their creditline.
 &#x60;amount&#x60; USDC is sent to the borrower, and the credit line accounting is updated.

| Name | Type | Description |
| ---- | ---- | ----------- |
| creditLineAddress | address | The creditline from which they would like to drawdown |
| amount | uint256 | The amount, in USDC atomic units, that a borrower wishes to drawdown Requirements: - the caller must be the borrower on the creditLine |

### pay

```solidity
function pay(address creditLineAddress, uint256 amount) external
```

Allows a borrower to repay their loan. Payment is *collected* immediately (by sending it to
 the individual CreditLine), but it is not *applied* unless it is after the nextDueTime, or until we assess
 the credit line (ie. payment period end).
 Any amounts over the minimum payment will be applied to outstanding principal (reducing the effective
 interest rate). If there is still any left over, it will remain in the USDC Balance
 of the CreditLine, which is held distinct from the Pool amounts, and can not be withdrawn by LP&#x27;s.

| Name | Type | Description |
| ---- | ---- | ----------- |
| creditLineAddress | address | The credit line to be paid back |
| amount | uint256 | The amount, in USDC atomic units, that a borrower wishes to pay |

### assessCreditLine

```solidity
function assessCreditLine(address creditLineAddress) public
```

Assesses a particular creditLine. This will apply payments, which will update accounting and
 distribute gains or losses back to the pool accordingly. This function is idempotent, and anyone
 is allowed to call it.

| Name | Type | Description |
| ---- | ---- | ----------- |
| creditLineAddress | address | The creditline that should be assessed. |

### applyPayment

```solidity
function applyPayment(address creditLineAddress, uint256 amount) external
```

### migrateV1CreditLine

```solidity
function migrateV1CreditLine(address _clToMigrate, address borrower, uint256 termEndTime, uint256 nextDueTime, uint256 interestAccruedAsOf, uint256 lastFullPaymentTime, uint256 totalInterestPaid) public returns (address, address)
```

### getUnderwriterCreditLines

```solidity
function getUnderwriterCreditLines(address underwriterAddress) public view returns (address[])
```

Simple getter for the creditlines of a given underwriter

| Name | Type | Description |
| ---- | ---- | ----------- |
| underwriterAddress | address | The underwriter address you would like to see the credit lines of. |

### getBorrowerCreditLines

```solidity
function getBorrowerCreditLines(address borrowerAddress) public view returns (address[])
```

Simple getter for the creditlines of a given borrower

| Name | Type | Description |
| ---- | ---- | ----------- |
| borrowerAddress | address | The borrower address you would like to see the credit lines of. |

### getNextPaymentAmount

```solidity
function getNextPaymentAmount(address creditLineAddress, uint256 asOf) external view returns (uint256)
```

This function is only meant to be used by frontends. It returns the total
payment due for a given creditLine as of the provided timestamp. Returns 0 if no
payment is due (e.g. asOf is before the nextDueTime)

| Name | Type | Description |
| ---- | ---- | ----------- |
| creditLineAddress | address | The creditLine to calculate the payment for |
| asOf | uint256 | The timestamp to use for the payment calculation, if it is set to 0, uses the current time |

### collectPayment

```solidity
function collectPayment(contract CreditLine cl, uint256 amount) internal
```

Collects &#x60;amount&#x60; of payment for a given credit line. This sends money from the payer to the credit line.
 Note that payment is not *applied* when calling this function. Only collected (ie. held) for later application.

| Name | Type | Description |
| ---- | ---- | ----------- |
| cl | contract CreditLine | The CreditLine the payment will be collected for. |
| amount | uint256 | The amount, in USDC atomic units, to be collected |

### _applyPayment

```solidity
function _applyPayment(contract CreditLine cl, uint256 amount, uint256 timestamp) internal
```

Applies &#x60;amount&#x60; of payment for a given credit line. This moves already collected money into the Pool.
 It also updates all the accounting variables. Note that interest is always paid back first, then principal.
 Any extra after paying the minimum will go towards existing principal (reducing the
 effective interest rate). Any extra after the full loan has been paid off will remain in the
 USDC Balance of the creditLine, where it will be automatically used for the next drawdown.

| Name | Type | Description |
| ---- | ---- | ----------- |
| cl | contract CreditLine | The CreditLine the payment will be collected for. |
| amount | uint256 | The amount, in USDC atomic units, to be applied |
| timestamp | uint256 | The timestamp on which accrual calculations should be based. This allows us  to be precise when we assess a Credit Line |

### handlePayment

```solidity
function handlePayment(contract CreditLine cl, uint256 paymentAmount, uint256 timestamp) internal returns (uint256, uint256, uint256)
```

### isLate

```solidity
function isLate(contract CreditLine cl, uint256 timestamp) internal view returns (bool)
```

### getGoldfinchFactory

```solidity
function getGoldfinchFactory() internal view returns (contract GoldfinchFactory)
```

### updateAndGetInterestAndPrincipalOwedAsOf

```solidity
function updateAndGetInterestAndPrincipalOwedAsOf(contract CreditLine cl, uint256 timestamp) internal returns (uint256, uint256)
```

### withinCreditLimit

```solidity
function withinCreditLimit(uint256 amount, uint256 unappliedBalance, contract CreditLine cl) internal view returns (bool)
```

### withinTransactionLimit

```solidity
function withinTransactionLimit(uint256 amount) internal view returns (bool)
```

### calculateNewTermEndTime

```solidity
function calculateNewTermEndTime(contract CreditLine cl, uint256 balance) internal view returns (uint256)
```

### calculateNextDueTime

```solidity
function calculateNextDueTime(contract CreditLine cl) internal view returns (uint256)
```

### currentTime

```solidity
function currentTime() internal view virtual returns (uint256)
```

### underwriterCanCreateThisCreditLine

```solidity
function underwriterCanCreateThisCreditLine(uint256 newAmount, struct CreditDesk.Underwriter underwriter) internal view returns (bool)
```

### withinMaxUnderwriterLimit

```solidity
function withinMaxUnderwriterLimit(uint256 amount) internal view returns (bool)
```

### getCreditCurrentlyExtended

```solidity
function getCreditCurrentlyExtended(struct CreditDesk.Underwriter underwriter) internal view returns (uint256)
```

### updateCreditLineAccounting

```solidity
function updateCreditLineAccounting(contract CreditLine cl, uint256 balance, uint256 interestOwed, uint256 principalOwed) internal
```

### getUSDCBalance

```solidity
function getUSDCBalance(address _address) internal view returns (uint256)
```

### onlyValidCreditLine

```solidity
modifier onlyValidCreditLine(address clAddress)
```

