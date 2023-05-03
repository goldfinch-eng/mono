# AccessControl

AccessControl.sol audit

# Summary

No issues found

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

#### Function checklist

- [ ] Does necessary access control
- [ ] Emits an event on relevant state changes
- [ ] Uses checks effects interactions pattern

## Functions

### `initialize(address admin)`

Initializes the contract and sets the super admin.

- Re-initialization: correctly uses the `initializer` modifier

#### Function checklist

- [-] Does necessary access control
- [-] Emits an event on relevant state changes
- [-] Uses checks effects interactions pattern

### `setAdmin`

Sets the admin of a given resources.

#### Function checklist

- [x] Does necessary access control
- [x] Emits an event on relevant state changes: `AdminSet`
- [-] Uses checks effects interactions pattern

### `requireAdmin(address resource, address accessor)`

Used for external resources to enforce that only admins of said resource can do
something. This allows for external resources to delegate defining who is an
admin to the Access Control contract.

- Input validation: Asserts that the zero address can't be passed as an
  `accessor`

### `requireSuperAdmin`

- [ ] checks that the caller is an admin of the access control contract
