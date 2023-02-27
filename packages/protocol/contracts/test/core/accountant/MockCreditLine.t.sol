// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../../interfaces/ICreditLine.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

contract MockCreditLine is ICreditLine {
  uint256 private _balance;
  uint256 private _interestOwed;
  uint256 private _principalOwed;
  uint256 private _termEndTime;
  uint256 private _nextDueTime;
  uint256 private _interestAccruedAsOf;
  uint256 private _lastFullPaymentTime;
  address private _borrower;
  uint256 private _limit;
  uint256 private _interestApr;
  uint256 private _lateFeeApr;
  bool private _isLate;
  bool private _withinPrincipalGracePeriod;
  uint256 private _totalInterestAccrued;
  uint256 private _totalInterestAccruedAt;
  uint256 private _totalInterestPaid;
  uint256 private _totalInterestOwed;
  uint256 private _totalInterestOwedAt;
  uint256 private _interestOwedAt;
  uint256 private _interestAccrued;
  uint256 private _interestAccruedAt;
  uint256 private _principalOwedAt;
  uint256 private _totalPrincipalPaid;
  uint256 private _totalPrincipalOwedAt;
  uint256 private _totalPrincipalOwed;
  uint256 private _termStartTime;

  function balance() external view override returns (uint256) { return _balance; }
  function interestOwed() external view override returns (uint256) { return _interestOwed; }
  function principalOwed() external view override returns (uint256) { return _principalOwed; }
  function termEndTime() external view override returns (uint256) { return _termEndTime; }
  function nextDueTime() external view override returns (uint256) { return _nextDueTime; }
  function interestAccruedAsOf() external view override returns (uint256) { return _interestAccruedAsOf; }
  function lastFullPaymentTime() external view override returns (uint256) { return _lastFullPaymentTime; }
  function borrower() external view override returns (address) { return _borrower; }
  function currentLimit() external view override returns (uint256) { return _limit; }
  function limit() external view override returns (uint256) { return _limit; }
  function maxLimit() external view override returns (uint256) { return _interestApr; }
  function interestApr() external view override returns (uint256) { return _interestApr; }
  function lateFeeApr() external view override returns (uint256) { return _lateFeeApr; }
  function isLate() external view override returns (bool) { return _isLate; }
  function withinPrincipalGracePeriod() external view override returns (bool) { return _withinPrincipalGracePeriod; }
  function totalInterestAccrued() external view override returns (uint256) { return _totalInterestAccrued; }
  function totalInterestAccruedAt(uint256) external view override returns (uint256) { return _totalInterestAccruedAt; }
  function totalInterestPaid() external view override returns (uint256) { return _totalInterestPaid; }
  function totalInterestOwed() external view override returns (uint256) { return _totalInterestOwed; }
  function totalInterestOwedAt(uint256) external view override returns (uint256) { return _totalInterestOwedAt; }
  function interestOwedAt(uint256) external view override returns (uint256) { return _interestOwedAt; }
  function interestAccrued() external view override returns (uint256) { return _interestAccrued; }
  function interestAccruedAt(uint256) external view override returns (uint256) { return _interestAccruedAt; }
  function principalOwedAt(uint256) external view override returns (uint256) { return _principalOwedAt; }
  function totalPrincipalPaid() external view override returns (uint256) { return _totalPrincipalPaid; }
  function totalPrincipalOwedAt(uint256) external view override returns (uint256) { return _totalPrincipalOwedAt; }
  function totalPrincipalOwed() external view override returns (uint256) { return _totalPrincipalOwed; }
  function termStartTime() external view override returns (uint256) { return _termStartTime; }
  function setLimit(uint256) external override {}
  function setMaxLimit(uint256) external override {}
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr
  ) external override {}
  function pay(uint paymentAmount) external override returns (ITranchedPool.PaymentAllocation memory) {}
  function pay(
    uint256 principalPayment,
    uint256 interestPaymen
  ) external override returns (ITranchedPool.PaymentAllocation memory) {}
  function drawdown(uint256 amount) external override {}

  function setTermEndTime(uint256 __termEndTime) external {
    _termEndTime = __termEndTime;
  }

  function setBalance(uint256 __balance) external {
    _balance = __balance;
  }

  function setInterestOwed(uint256 __interestOwed) external {
    _interestOwed = __interestOwed;
  }

  function setPrincipalOwed(uint256 __principalOwed) external {
    _principalOwed = __principalOwed;
  }

  function setInterestApr(uint256 __interestApr) external {
    _interestApr = __interestApr;
  }
}