# CallableLoanAccountant

# Summary

No issues found.

_calculateInterest_

Noting possible tradeoff to avoid overflow, this may lose precision due to the internal division. However, the loss of precision depends on the input variables and fuzzing was unable to find a significant difference.

```
assuming
principal: 24956606405162830083662
interestApr: 56606405162830083413
secondsElapsed: 1132663 // ~13 days
INTEREST_DECIMALS: -
SECONDS_PER_YEAR: -

uint256 totalInterestPerYear = (principal * interestApr) / INTEREST_DECIMALS;
interest = (totalInterestPerYear * secondsElapsed) / SECONDS_PER_YEAR;
-> 50739386554571744112319

interest = (principal * interestApr * secondsElapsed) / SECONDS_PER_YEAR / INTEREST_DECIMALS;
-> 50739386554571744112320

// difference of 1
// compared using forge fuzzing with light bounds on input variables
```

# Appendix

- Do all functions have appropriate access controls?
  - ✅ Yes - internal
