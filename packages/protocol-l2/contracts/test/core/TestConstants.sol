// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

library TestConstants {
  uint256 public constant INTEREST_DECIMALS = 1e18;
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 public constant SECONDS_PER_YEAR = (SECONDS_PER_DAY * 365);
  uint256 public constant USDC_DECIMALS = 6;
}
