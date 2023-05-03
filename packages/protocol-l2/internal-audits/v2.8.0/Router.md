# Router

Central repository for getting contracts relevant for cake

# Summary

- No event emitted when _setContract_ is called
  - **Severity**: 🟢 Informational
  - **Description**: No event is emitted when a new contract is set but we should have one
  - **Suggested Fix**: Add an event

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference/completeness

## Functions

### `initialize`

- Uses `initializer` modifier
  Sets the access control key so that `setContract` can use check if the caller is an admin

### `setContract`

- Set a key to a specific contract
- Requires that the caller is an admin, determined by the access control contract
- ! Router does not emit an event when a contract is updated

## Issues

- 🟢 No event is emitted when `setContract` is called
