# MembershipScores Audit

MembershipScores.sol audit.

# Summary

No issues found

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## External Functions

### `calculateScore`

- [x] Prevents alpha from being > 1 which would cause an unbounded membership score
- [x] Safe math used
- [x] Safe casting
