# Waterfall

# Summary

_pay_

It's unclear if this is a bug or not, but is confusing. PrincipalPayment is subtracted out with respect to reserves, but emitted against a total value _without_ reserves at the end.

# Appendix

- Do all functions have appropriate access controls?
  - ✅ Yes - internal or private
