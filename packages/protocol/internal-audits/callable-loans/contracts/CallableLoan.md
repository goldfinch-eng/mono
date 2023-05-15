# CallableLoan

# Summary

No issues found.

# Appendix

- Does _initialize_ have appropriate access controls?

  - ✅ Yes - initializer

- Does _submitCall_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _deposit_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _depositWithPermit_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _withdraw_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _withdrawMultiple_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _withdrawMax_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _drawdown_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused, onlyLocker

- Does _pay_ have appropriate access controls?

  - ✅ Yes - nonReentrant, whenNotPaused

- Does _pauseDrawdowns_ have appropriate access controls?

  - ✅ Yes - onlyAdmin

- Does _unpauseDrawdowns_ have appropriate access controls?

  - ✅ Yes - onlyAdmin

- Does _setAllowedUIDTypes_ have appropriate access controls?

  - ✅ Yes - onlyLocker

- Does _setFundableAt_ have appropriate access controls?

  - ✅ Yes - onlyLocker

- Do the remaining functions have appropriate access controls?
  - ✅ Yes - view, internal, private, or combination
