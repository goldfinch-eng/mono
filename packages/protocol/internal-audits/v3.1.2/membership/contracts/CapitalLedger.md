# CapitalLedger

# Summary
No issues found, but we should add a test for access control

# Appendix
- Does _harvest_ have appropriate access controls?
  - ✅ Yes - restricted to MembershipOrchestrator
  - ❓ Nit - missing test for this!
- Does _\_kick_ have appropriate access controls?
  - ✅ Yes, internal
  - ❓ Can remove `onlyOperator` modifier because it's internal