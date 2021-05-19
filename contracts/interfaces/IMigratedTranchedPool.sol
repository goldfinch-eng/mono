// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IV2CreditLine.sol";
import "./IV1CreditLine.sol";
import "./ITranchedPool.sol";

abstract contract IMigratedTranchedPool is ITranchedPool {
  function migrateCreditLine(
    IV1CreditLine clToMigrate,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid,
    uint256 totalPrincipalPaid
  ) external virtual returns (IV2CreditLine);
}
