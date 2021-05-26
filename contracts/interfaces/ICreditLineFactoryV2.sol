// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ICreditLineFactoryV2 {
  function createCreditLine() external returns (address);
}
