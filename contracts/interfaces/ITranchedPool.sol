// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

abstract contract ITranchedPool {
  struct TrancheInfo {
    uint256 principalDeposited;
    uint256 interestAPR;
    uint256 principalSharePrice;
    uint256 interestSharePrice;
  }

  TrancheInfo public seniorTranche;
  TrancheInfo public juniorTranche;
}
