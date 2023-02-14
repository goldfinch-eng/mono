# MembershipVault

Audit for MembershipVault.sol

# Summary
No security issues found, but there is one recommendation for increased clarity that I believe will help
in future audits by reducing the difficulty to reason about the code.

## Rename `owners` map to `positionIdByOwner`
- In general, maps are names in reference to their keys. E.g. the `positions` map, also declared in MembershipVault
- This is confusing when reading map invocations, especially where the returned value is used as the
  key to another map.
  ```
  Position memory position = positions[owners[owner]];
  ```
  Alternatively
  ```
  Position memory position = positions[positionIdByOwner[owner]];
  ```
