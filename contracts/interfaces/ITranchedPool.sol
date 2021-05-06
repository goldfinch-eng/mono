// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IV2CreditLine.sol";

abstract contract ITranchedPool {
  IV2CreditLine public creditLine;
  uint256 public createdAt;

  enum Tranches {Reserved, Senior, Junior}

  struct TrancheInfo {
    uint256 principalDeposited;
    uint256 interestAPR;
    uint256 principalSharePrice;
    uint256 interestSharePrice;
    uint256 lockedAt;
  }

  function initialize(
    address owner,
    address _config,
    address _creditLine,
    uint256 _juniorFeePercent
  ) public virtual;

  function getTranche(uint256 tranche) external view virtual returns (TrancheInfo memory);

  function deposit(uint256 tranche, uint256 amount) external virtual;

  function withdraw(uint256 tokenId, uint256 amount) external virtual;

  function withdrawMax(uint256 tokenId) external virtual;
}
