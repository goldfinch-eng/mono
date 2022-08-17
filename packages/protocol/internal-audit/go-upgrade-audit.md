# Internal Audit

## Goals

- Review Go.sol for vulnerabilities since there were changes to allow tx.origin UID owners to be considered golisted
- Review Go-dependent contracts in the Goldfinch protocol for potential vulnerabilities as a result of new msg.sender possibilities. Reentrancy attacks are a specific concern.
- Review general Ethereum contract ecosystem for smart contract attack vectors - any smart contracts which could amplify existing attacks or enable new attacks.

- Timebox the audit to roughly 8 hrs total eng time (eng resource constraint)

  - Roughly 1 hour per eng. for each of the following
    - Discussions
    - Finding & reviewing functions of interest in Go & dependent contracts
    - Looking for general Ethereum smart contract attack vectors which could pose threats
    - Sharing findings and then investigating any new, shared concerns

- Only review public/external functions of Goldfinch protocol contracts to satisfy time constraints.

## Go

### Responsibilities of the contract

Go is the source of truth on whether an Ethereum address is allowed to interact with KYC-gated features of the Goldfinch protocol.

#### State mutating functions

- initialize(address owner,GoldfinchConfig \_config,address \_uniqueIdentity) public initializer
- [] How could it break?
- performUpgrade() external onlyAdmin
- [] How could it break?
- setLegacyGoList(GoldfinchConfig \_legacyGoList) external onlyAdmin
- [] How could it break?
- initZapperRole() external onlyAdmin
- [] How could it break?

- exampleFunc1
  - [] How could it break?
    - Fail to call initializers of inherited functions
      - Current defense
        - None / manual
      - Review status
        - NOT REVIEWED
    - Allow zero-address `owner`
      - Review status
        - BUG
          - REMEDY
            - Priority: LOW
              - The contract has already been initialized.
- exampleFunc2
  - [] How could it break?
    - Fail to set the correct role (owner role) as admin of Zapper role
      - Current defense
        - None / manual
      - Review status
        - Looks OK, but did not review `_setRoleAdmin()` function internals

#### View / pure functions

<!-- Add reviewed external/public view/pure functions here, along with steps taken to verify expected behavior  -->

- goOnlyIdTypes(address account, uint256[] memory onlyIdTypes) public view
- [] How could it break?
- getAllIdTypes() public view returns (uint256[] memory)
- [] How could it break?
- getSeniorPoolIdTypes() public pure returns (uint256[] memory)
- [] How could it break?
- go(address account) public view override returns (bool)
- [] How could it break?
- goSeniorPool(address account) public view override returns (bool)
- [] How could it break?
- exampleViewFunc
  - [] How could it break?
    - Review status
      - SKIPPED. Hasn't changed in 8 months.
- examplePureFunc
  - [] How could it break?
    - Incorrect arithmetic
      - Review status
        - ISSUE
          - Do we not want to sanity-check the returned "effective amount" value, as some multiple of the original `amount`, to prevent some extreme multiple?
        - REMEDY
          - Priority: CRITICAL
          - We should evaluate whether we are comfortable fully relying on the base token exchange rate and effective multiplier values having been set correctly "upstream", or whether we'd feel better about imposing a cap on the combined multiplicative effect of those two values.
          - Decision: We are comfortable relying on setting bounds on the base token exchange rate, plus our testing of setting the effective multiplier value.

#### Additional Notes

- Go contract state variables and internal functions were not reviewed due to time constraints.
- No modifiers exist for Go contract.

## TranchedPool
### State Mutating Functions
- deposit
- withdraw

## StakingRewards
### Mutating Functions
- depositAndStake
- unstakeAndWithdraw
- unstakeAndWithdrawMultiple

## SeniorPool
### Mutating Functions
- deposit
- withdraw
- withdrawInFidu