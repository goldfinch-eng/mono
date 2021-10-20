// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IPoolRewards {
  function allocateRewards(uint256 _interestPaymentAmount) external;
}
