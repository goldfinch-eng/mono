
// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;
pragma experimental ABIEncoderV2;

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {Waterfall, WaterfallLogic} from "./Waterfall.sol";

struct CreditLine {
  Waterfall _waterfall;
  uint256 _interestApr;
  uint256 _lateFeeApr;

  uint256 _totalInterestPaid;
  uint256 _lastFullPaymentTime;
  uint256 _totalInterestAccrued;
  uint256 _totalInterestOwed;
  uint256 _checkpointedAsOf;
}

library CreditLineLogic {
  function init(
    CreditLine storage cl,
    uint _interestApr,
    ISchedule _schedule,
    uint _lateFeeApr
  ) external {
    // TODO
  }

  function pay(
    CreditLine storage cl,
    uint256 principalAmount,
    uint256 interestAmount
  ) external {
    // TODO: interestOwed -> principalOwed -> interestAccrued -> prepayments
    cl._waterfall.pay(interestAmount, principalAmount);
  }

  function drawdown(uint256 amount) external {
    // TODO: enforce limit
    cl._waterfall.drawdown(amount);
  }

  function call(uint256 amount) external {
    // TODO:
  }


  function deposit(uint256 amount) external {
    // TODO:
  }

  function withdraw(uint256 amount) external {
    // TODO
  }

  ////////////////////////////////////////////////////////////////////////////////
  // VIEW
  ////////////////////////////////////////////////////////////////////////////////
  function withinPrincipalGracePeriod(CreditLine storage cl) external view returns (bool) {
    // TODO:
  }

  function nextDueTimeAt(uint timestamp) external view returns (uint) {
    // TODO:
  }

  function termStartTime() external view returns (uint) {
    // TODO
  }

  function termEndtime() external view returns (uint) {
    // TODO:
  }

  function principalOwedAt(uint timestamp) external view returns (uint) {
    // TODO:
  }

  function principalOwed() external view returns (uint) {
    // TODO:
  }

  function totalPrincipalOwedAt(uint timestsamp) external view returns (uint) {
    // TODO:
  }

  function totalInterestOwed() external view returns (uint) {
    // TODO:
  }

  function interestOwed() external view returns (uint) {
    // TODO:
  }

  function interestOwedAt(uint timestamp) external view returns (uint) {
    // TODO:
  }

  function interestAccruedAt(uint timestamp) external view returns (uint) {
    // TODO:
  }
}