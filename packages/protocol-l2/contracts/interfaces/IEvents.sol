// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

/// @notice Common events that can be emmitted by multiple contracts
interface IEvents {
  /// @notice Emitted when a safety check fails
  event SafetyCheckTriggered();
}
