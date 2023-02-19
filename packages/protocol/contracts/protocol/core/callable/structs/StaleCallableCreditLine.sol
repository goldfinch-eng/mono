// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";

import {Waterfall} from "./Waterfall.sol";
import {CallableCreditLine, CallableCreditLineLogic, SettledTrancheInfo} from "./CallableCreditLine.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";

struct StaleCallableCreditLine {
  CallableCreditLine _cl;
}

using StaleCallableCreditLineLogic for StaleCallableCreditLine global;

/**
 * Simple wrapper around CallableCreditLine which returns a checkpointed
 * CallableCreditLine after checkpoint() is called.
 */
library StaleCallableCreditLineLogic {
  function initialize(
    StaleCallableCreditLine storage cl,
    IGoldfinchConfig _config,
    uint _interestApr,
    ISchedule _schedule,
    uint _lateAdditionalApr,
    uint _limit
  ) internal {
    cl._cl.initialize(_config, _interestApr, _schedule, _lateAdditionalApr, _limit);
  }

  function checkpoint(
    StaleCallableCreditLine storage cl
  ) internal returns (CallableCreditLine storage) {
    cl._cl.checkpoint();
    return cl._cl;
  }

  function schedule(StaleCallableCreditLine storage cl) internal view returns (ISchedule) {
    return cl._cl._paymentSchedule.schedule;
  }

  function termStartTime(StaleCallableCreditLine storage cl) internal view returns (uint64) {
    return cl._cl.termStartTime();
  }

  function lastFullPaymentTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.lastFullPaymentTime();
  }

  function limit(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.limit();
  }

  function interestApr(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.interestApr();
  }

  function lateFeeApr(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.lateFeeApr();
  }

  function isLate(StaleCallableCreditLine storage cl) internal view returns (bool) {
    return cl._cl.isLate();
  }

  function checkpointedAsOf(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.checkpointedAsOf();
  }

  function interestOwed(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.interestOwed();
  }

  function principalOwed(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.principalOwed();
  }

  function interestOwedAt(
    StaleCallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._cl.interestOwedAt(timestamp);
  }

  function principalOwedAt(
    StaleCallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._cl.principalOwedAt(timestamp);
  }

  function totalInterestOwedAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.totalInterestOwedAt(timestamp);
  }

  function totalPrincipalOwedAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.totalPrincipalOwedAt(timestamp);
  }

  function totalInterestOwed(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalInterestOwed();
  }

  function totalPrincipalOwed(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalPrincipalOwed();
  }

  function totalPrincipalOutstanding(
    StaleCallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._cl.totalPrincipalOutstanding();
  }

  function nextInterestDueTimeAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._cl.nextInterestDueTimeAt(timestamp);
  }

  function nextPrincipalDueTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.nextPrincipalDueTime();
  }

  function nextPrincipalDueTimeAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._cl.nextPrincipalDueTimeAt(timestamp);
  }

  function nextDueTimeAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._cl.nextDueTimeAt(timestamp);
  }

  function nextDueTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.nextDueTime();
  }

  function termEndTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.termEndTime();
  }

  function proportionalInterestAndPrincipalAvailable(
    StaleCallableCreditLine storage cl,
    uint trancheId,
    uint principal
  ) internal view returns (uint, uint) {
    return cl._cl.proportionalInterestAndPrincipalAvailable(trancheId, principal);
  }

  function totalInterestAccrued(
    StaleCallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._cl.totalInterestAccrued();
  }

  function totalInterestAccruedAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.totalInterestAccruedAt(timestamp);
  }

  function interestAccrued(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.interestAccrued();
  }

  function interestAccruedAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.interestAccruedAt(timestamp);
  }

  function totalInterestPaid(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalInterestPaid();
  }

  function totalPrincipalPaidAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.totalPrincipalPaidAt(timestamp);
  }

  function totalPrincipalPaid(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalPrincipalPaid();
  }

  function withinPrincipalGracePeriod(
    StaleCallableCreditLine storage cl
  ) internal view returns (bool) {
    return cl._cl.withinPrincipalGracePeriod();
  }

  function uncalledCapitalTrancheIndex(
    StaleCallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._cl.uncalledCapitalTrancheIndex();
  }

  function getSettledTrancheInfo(
    StaleCallableCreditLine storage cl,
    uint256 trancheId
  ) internal view returns (SettledTrancheInfo memory) {
    return cl._cl.getSettledTrancheInfo(trancheId);
  }
}
