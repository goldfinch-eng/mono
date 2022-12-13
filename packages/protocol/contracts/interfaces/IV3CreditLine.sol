// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {IV2TranchedPool} from "./IV2TranchedPool.sol";
import {ICreditLine} from "./ICreditLine.sol";

interface IV3CreditLine is ICreditLine {
  /// @notice Cumulative interest accrued up to now
  function totalInterestAccrued() external view returns (uint256);

  /// @notice Cumulative interest accrued up to `timestamp`
  function totalInterestAccruedAt(uint256 timestamp) external view returns (uint256);

  /// @notice Cumulative interest paid back up to now
  function totalInterestPaid() external view returns (uint256);

  /// @notice Cumulative interest owed up to now
  function totalInterestOwed() external view returns (uint256);

  /// @notice Cumulative interest owed up to `timestamp`
  function totalInterestOwedAt(uint256 timestamp) external view returns (uint256);

  /// @notice Interest that would be owed at `timestamp`
  function interestOwedAt(uint256 timestamp) external view returns (uint256);

  /// @notice Interest accrued in the current payment period up to now. Converted to
  ///   owed interest once we cross into the next payment period. Is 0 if the
  ///   current time is after loan maturity (all interest accrued immediately becomes
  ///   interest owed).
  function interestAccrued() external view returns (uint256);

  /// @notice Interest accrued in the current payment period for `timestamp`. Coverted to
  ///   owed interest once we cross into the payment period after `timestamp`. Is 0
  ///   if `timestamp` is after loan maturity (all interest accrued immediately becomes
  ///   interest owed).
  function interestAccruedAt(uint256 timestamp) external view returns (uint256);

  /// @notice Principal owed up to `timestamp`
  function principalOwedAt(uint256 timestamp) external view returns (uint256);

  function setLimit(uint256 newAmount) external;

  function setMaxLimit(uint256 newAmount) external;

  /// @notice Time of first drawdown
  function termStartTime() external view returns (uint256);

  /// @notice Initialize a brand new credit line
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays
  ) external;

  /// @notice Initialize a new credit line from another credit line. Accounting variables are copied over
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays,
    IV3CreditLine other
  ) external;

  /// @notice Process a payment.
  ///   `paymentAmount` is applied to debts as a waterfall in the following order:
  ///     1. interest owed
  ///     2. interest accrued in the current payment period (not yet owed)
  ///     3. principal owed
  ///     4. remaining balance
  /// @param paymentAmount USDC amount to pay
  /// @return paymentAllocation amounts allocated to each debt owed
  function pay(uint256 paymentAmount) external returns (IV2TranchedPool.PaymentAllocation memory);

  /// @notice Process a payment, splitting the payment into two separate waterfalls, one for interest and
  ///   another for principal.
  ///
  ///   `principalPayment` is applied to principal debts in the waterfall:
  ///     1. principal owed
  ///     2. remaining balance
  ///
  ///   `interestPayment` is applied to the interest debts in the waterfall:
  ///     1. interest owed
  ///     2. interest accrued in the current payment period (not yet owed)
  /// @param principalPayment USDC amount of principal to pay
  /// @param interestPayment USDC amount of interest to pay
  /// @return PaymentAllocation amounts allocated to each debt owed
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) external returns (IV2TranchedPool.PaymentAllocation memory);

  /// @notice Drawdown on the line
  /// @param amount amount to drawdown. Cannot exceed the line's limit
  function drawdown(uint256 amount) external;

  /// @notice Close this credit line. Only use when migrating to a new credit line
  function close() external;
}
