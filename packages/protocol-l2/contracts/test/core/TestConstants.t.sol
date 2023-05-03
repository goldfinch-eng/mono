// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

library TestConstants {
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant ZAPPER_ROLE = keccak256("ZAPPER_ROLE");
  bytes32 public constant SENIOR_ROLE = keccak256("SENIOR_ROLE");
  bytes32 public constant GO_LISTER_ROLE = keccak256("GO_LISTER_ROLE");
  bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");
  bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

  uint256 public constant USDC_DECIMALS = 6;
  uint256 public constant FIDU_DECIMALS = 18;
  uint256 public constant INTEREST_DECIMALS = 1e18;
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 public constant SECONDS_PER_YEAR = (SECONDS_PER_DAY * 365);
}
