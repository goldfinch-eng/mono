// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IPauser {
  function isPaused(address) external view returns (bool);

  function pause(address) external;

  function unpause(address) external;

  function globalPause() external;

  function globalUnpause() external;

  event Paused(address account);
  event Unpaused(address account);
  event GlobalPaused();
  event GlobalUnpaused();
}