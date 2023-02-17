// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// import {console2 as console} from "forge-std/console2.sol";

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";

import {Waterfall, WaterfallLogic, TrancheLogic, Tranche} from "./Waterfall.sol";
import {CallableCreditLine, CallableCreditLineLogic} from "./CallableCreditLine.sol";

import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";

struct StaleCallableCreditLine {
  CallableCreditLine _cl;
}

using StaleCallableCreditLineLogic for StaleCallableCreditLine global;

/**
 * Dumb wrapper around CallableCreditLine which returns a checkpointed
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

  /**
   * Returns the total amount of principal outstanding  - after settling any reserved principal which
   * was set aside for now elapsed call request periods.
   */
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

  /**
   * Returns the total interest paid.
   * Not a preview because interest is not (in current implementation) dependent upon checkpoint/settling reserves.
   * This would require a checkpoint if principal payments could be settled on a more granular basis,
   * potentially modifying interest accrual amount mid month/quarter.
   */
  function totalInterestPaid(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalInterestPaid();
  }

  /**
   * Returns the total amount of principal paid  - after settling any reserved principal which
   * was set aside for call request periods which would have elapsed at timestamp.
   */
  function totalPrincipalPaidAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint256) {
    return cl._cl.totalPrincipalPaidAt(timestamp);
  }

  /**
   * Returns the total amount of principal paid  - after settling any reserved principal which
   * was set aside for now elapsed call request periods.
   */
  function totalPrincipalPaid(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return cl._cl.totalPrincipalPaid();
  }
}
