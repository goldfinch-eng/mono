pragma solidity 0.6.12;

// solhint-disable-next-line max-line-length
// Based on https://github.com/gnosis/safe-contracts/blob/94f9b9083790495f67b661bfa93b06dcba2d3949/contracts/common/MasterCopy.sol

/// @title MasterCopy - Base for master copy contracts (should always be first super contract)
///         This contract is tightly coupled to our proxy contract (see `GoldfinchProxy.sol`)
contract MasterCopy {
  // configAddress and the masterCopyIndex always needs to be first two declared variables, to ensure that it is
  // at the same location in the contracts to which calls are delegated.
  // To reduce deployment costs this variable is private and needs to be retrieved via `getStorageAt`
  address private _configAddress;
  uint256 private _configMasterCopyIndex;
}
