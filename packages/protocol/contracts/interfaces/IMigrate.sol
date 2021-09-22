// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

abstract contract IMigrate {
  function pause() public virtual;

  function unpause() public virtual;

  function updateGoldfinchConfig() external virtual;

  function grantRole(bytes32 role, address assignee) external virtual;

  function renounceRole(bytes32 role, address self) external virtual;

  // Proxy methods
  function transferOwnership(address newOwner) external virtual;

  function changeImplementation(address newImplementation, bytes calldata data) external virtual;

  function owner() external view virtual returns (address);

  // CreditDesk
  function migrateV1CreditLine(
    address _clToMigrate,
    address borrower,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid
  ) public virtual returns (address, address);

  // Pool
  function migrateToSeniorPool() external virtual;
}
