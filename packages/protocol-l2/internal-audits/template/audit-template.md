# Internal Audit

<!-- Follow this template as a loose guide for double checking functions -->
<!-- Try not to limit investigation to just functions in isolation -->
<!-- Opt for using unit tests as living documentation & reproducible examples of potential bugs or exploits. -->

## Audit authors

<!-- Add author names or GitHub handles here -->

### Goals

Break the contracts. Get them to do something we wouldn't want them to do.

<!-- Add any specific areas of concern for the audit -->
<!-- Add any time or resource constraints for the scope of the audit -->

## MyContract <!-- Replace with your contract name -->

### Responsibilities of the contract

<!-- Add high level descriptions of the responsibilities of the contract -->

#### State mutating functions

<!-- Add reviewed state mutating functions here, along with steps taken to verify expected behavior  -->

##### External / public

- exampleFunc1
  - [x] How could it break?
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
  - [x] How could it break?
    - Fail to set the correct role (owner role) as admin of Zapper role
      - Current defense
        - None / manual
      - Review status
        - Looks OK, but did not review `_setRoleAdmin()` function internals

##### Internal

#### View / pure functions

##### External / Public

<!-- Add reviewed external/public view/pure functions here, along with steps taken to verify expected behavior  -->

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

##### Internal

<!-- Add reviewed external/public view/pure functions here, along with steps taken to verify expected behavior  -->

#### Modifiers

<!-- Review modifiers to ensure they fulfill expected guarantees -->

- modifier1
  - [x] How could it break?
    - Allow non-Go listed users through
      - Review status
        - OK
- modifier2
  - [x] How could it break?
    - Improper passage of arguments to `toEffectiveAmount()`
      - Review status
        - OK

#### State variables

<!-- Review state variables to ensure that contract security is upheld while state variables hold any possible value.  -->

- stateVar1
  - Review status
    - OK
- stateVar2
  - Review status
    - SKIPPED

#### Events

<!-- Review event information to ensure accuracy  -->

- event1
  - Review status
    - OK
- event2
  - Review status
    - SKIPPED

#### Additional Notes

- [] Pre-audit checklist redundancy checks (see [Notion doc](https://www.notion.so/goldfinchfinance/Pre-audit-checklist-be502a1333ce49af835856a98ea02642))
  - [] Do mutative functions follow checks-effects-interactions pattern?
  - [] Do mutative functions apply the noReentrancy modifier?
    <!-- See pre-audit checklist -->
    <!-- Include any additional notes that don't fit into above categories -->

<!-- Copy MyContract1 template for any additional contracts under audit. -->
<!-- ## MyContract2  Replace with another contract name -->

## Issues

<!-- Add any general issues or points of concern which did not fit into any one contract/function. -->

### Issue #1 title <!-- Replace with your issue title name -->

<!--  Add description of issue -->

# Conclusions

<!--  Self-explanatory - add audit conclusions here -->

## Action Items

<!--  Self-explanatory - add audit action items here -->
