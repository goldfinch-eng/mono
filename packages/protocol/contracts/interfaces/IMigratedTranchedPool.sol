// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IV2CreditLine.sol";
import "./IV1CreditLine.sol";
import "./ITranchedPool.sol";

abstract contract IMigratedTranchedPool is ITranchedPool {
  function migrateCreditLineToV2(
    IV1CreditLine clToMigrate,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid
  ) external virtual returns (IV2CreditLine);
}
