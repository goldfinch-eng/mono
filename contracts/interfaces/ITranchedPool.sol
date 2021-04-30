// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IV2CreditLine.sol";

abstract contract ITranchedPool {
  IV2CreditLine public creditLine;
  uint256 public createdAt;

  struct TrancheInfo {
    uint256 principalDeposited;
    uint256 interestAPR;
    uint256 principalSharePrice;
    uint256 interestSharePrice;
    uint256 lockedAt;
  }

  TrancheInfo public seniorTranche;
  TrancheInfo public juniorTranche;

  function initialize(
    address owner,
    address _config,
    address _creditLine
  ) public virtual;
}
