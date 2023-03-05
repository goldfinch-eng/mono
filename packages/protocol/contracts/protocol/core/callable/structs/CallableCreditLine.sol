// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// import {console2 as console} from "forge-std/console2.sol";

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {ICallableLoan} from "../../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../../interfaces/ICallableLoanErrors.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";

import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {CallableLoanAccountant} from "../CallableLoanAccountant.sol";
import {LockState} from "../../../../interfaces/ICallableLoan.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import {Tranche} from "./Tranche.sol";
import {Waterfall} from "./Waterfall.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";
import {ConfigNumbersHelper} from "../../ConfigNumbersHelper.sol";

using CallableCreditLineLogic for CallableCreditLine global;

// TODO: Add notes to fields to describe each (pseudo-natspec)
/// @param _numLockupPeriods Describes when newly submitted call requests are rolled over
///                          to the next call request period.
///                          Number of periods is relative to the end date of a call request period.
///                          e.g. if _numLockupPeriods is 2, then newly submitted call requests
///                          in the last two periods of a call request period will be rolled over
///                          to the next call request period.
struct CallableCreditLine {
  IGoldfinchConfig _config;
  uint256 _limit;
  uint256 _interestApr;
  uint256 _lateAdditionalApr;
  //
  uint256 _numLockupPeriods;
  uint256 _checkpointedAsOf;
  uint256 _lastFullPaymentTime;
  // Similar idea to existing tranched pool credit lines
  uint256 _totalInterestOwedAtLastCheckpoint;
  // Similar idea to existing tranched pool credit lines
  uint256 _totalInterestAccruedAtLastCheckpoint;
  Waterfall _waterfall;
  PaymentSchedule _paymentSchedule;
  uint[50] __padding;
}

struct SettledTrancheInfo {
  uint256 principalDeposited;
  uint256 principalPaid;
  uint256 principalReserved;
  uint256 interestPaid;
}

/**
 * Handles the accounting of borrower obligations in a callable loan.
 * Allows
 *  - Deposit of funds before the loan is drawn down.
 *  - Drawdown of funds which should start the loan.
 *  - Repayment of drawndown funds which should reduce the borrower's obligations according to the payment waterfall.
 *  - Withdrawal of undrawndown funds whi
 */
library CallableCreditLineLogic {
  using SaturatingSub for uint256;
  using ConfigNumbersHelper for IGoldfinchConfig;

  /*================================================================================
  Constants
  ================================================================================*/
  uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 internal constant MINIMUM_WATERFALL_TRANCHES = 2;

  /*================================================================================
  Errors
  ================================================================================*/

  function initialize(
    CallableCreditLine storage cl,
    IGoldfinchConfig _config,
    uint256 _interestApr,
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateAdditionalApr,
    uint256 _limit
  ) internal {
    // NOTE: Acts as implicit initializer check - should not be able to reinitialize.
    if (cl._checkpointedAsOf != 0) {
      revert ICallableLoanErrors.CannotReinitialize();
    }
    cl._config = _config;
    cl._limit = _limit;
    cl._numLockupPeriods = _numLockupPeriods;
    cl._paymentSchedule = PaymentSchedule(_schedule, 0);
    cl._waterfall.initialize(_schedule.totalPrincipalPeriods());
    cl._interestApr = _interestApr;
    cl._lateAdditionalApr = _lateAdditionalApr;
    cl._checkpointedAsOf = block.timestamp;

    // Initialize cumulative/settled values
    cl._lastFullPaymentTime = block.timestamp;
    cl._totalInterestAccruedAtLastCheckpoint = 0;
    cl._totalInterestOwedAtLastCheckpoint = 0;
    if (cl._waterfall.numTranches() < 2) {
      revert ICallableLoanErrors.NeedsMorePrincipalPeriods(
        cl._waterfall.numTranches(),
        MINIMUM_WATERFALL_TRANCHES
      );
    }
  }

  /*================================================================================
  Main Write Functions
  ================================================================================*/
  function pay(
    CallableCreditLine storage cl,
    uint256 principalPayment,
    uint256 interestPayment
  ) internal {
    LockState lockState = cl.lockState();
    if (lockState != LockState.Unlocked) {
      revert ICallableLoanErrors.InvalidLockState(lockState, LockState.Unlocked);
    }

    cl._waterfall.pay({
      principalAmount: principalPayment,
      interestAmount: interestPayment,
      reserveTranchesIndexStart: cl._paymentSchedule.currentPrincipalPeriod()
    });

    if (cl.principalOwed() == 0 && cl.interestOwed() == 0) {
      cl._lastFullPaymentTime = block.timestamp;
    }
  }

  function drawdown(CallableCreditLine storage cl, uint256 amount) internal {
    LockState lockState = cl.lockState();
    if (lockState == LockState.Funding) {
      cl._paymentSchedule.startAt(block.timestamp);
      cl._lastFullPaymentTime = block.timestamp;
      lockState = cl.lockState();
      emit DepositsLocked(address(this));
      // Scaffolding: TODO: Remove - this invariant should always be true across all tests.
      require(
        lockState == LockState.DrawdownPeriod,
        "Scaffolding failure: Should be DrawdownPeriod"
      );
    }
    if (lockState != LockState.DrawdownPeriod) {
      revert ICallableLoanErrors.InvalidLockState(lockState, LockState.DrawdownPeriod);
    }

    if (amount > cl.totalPrincipalPaid()) {
      revert ICallableLoanErrors.DrawdownAmountExceedsDeposits(amount, cl.totalPrincipalPaid());
    }
    cl._waterfall.drawdown(amount);
  }

  function submitCall(
    CallableCreditLine storage cl,
    uint256 amount
  )
    internal
    returns (
      uint256 principalDepositedMoved,
      uint256 principalPaidMoved,
      uint256 principalReservedMoved,
      uint256 interestMoved
    )
  {
    LockState lockState = cl.lockState();
    if (lockState != LockState.Unlocked) {
      revert ICallableLoanErrors.InvalidLockState(lockState, LockState.Unlocked);
    }

    uint256 activeCallTranche = cl.activeCallSubmissionTrancheIndex();
    if (activeCallTranche >= cl.uncalledCapitalTrancheIndex()) {
      revert ICallableLoanErrors.TooLateToSubmitCallRequests();
    }
    if (cl.inLockupPeriod()) {
      revert ICallableLoanErrors.CannotSubmitCallInLockupPeriod();
    }
    return cl._waterfall.move(amount, cl.uncalledCapitalTrancheIndex(), activeCallTranche);
  }

  function deposit(CallableCreditLine storage cl, uint256 amount) internal {
    LockState lockState = cl.lockState();
    if (lockState != LockState.Funding) {
      revert ICallableLoanErrors.InvalidLockState(lockState, LockState.Funding);
    }
    if (amount + cl._waterfall.totalPrincipalDeposited() > cl.limit()) {
      revert ICallableLoanErrors.DepositExceedsLimit(
        amount,
        cl._waterfall.totalPrincipalDeposited(),
        cl.limit()
      );
    }
    cl._waterfall.deposit(cl.uncalledCapitalTrancheIndex(), amount);
  }

  /// Withdraws funds from the specified tranche.
  function withdraw(CallableCreditLine storage cl, uint256 trancheId, uint256 amount) internal {
    LockState lockState = cl.lockState();
    if (lockState != LockState.Funding) {
      revert ICallableLoanErrors.InvalidLockState(lockState, LockState.Funding);
    }
    cl._waterfall.withdraw({trancheId: trancheId, principalAmount: amount});
  }

  /// Settles payment reserves and updates the checkpointed values.
  function checkpoint(CallableCreditLine storage cl) internal {
    LockState lockState = cl.lockState();
    if (lockState == LockState.Funding) {
      return;
    }

    uint256 currentlyActivePeriod = cl._paymentSchedule.currentPeriod();
    uint256 activePeriodAtLastCheckpoint = cl._paymentSchedule.periodAt(cl._checkpointedAsOf);

    if (currentlyActivePeriod > activePeriodAtLastCheckpoint) {
      cl._waterfall.settleReserves(currentlyActivePeriod - 1);
    }

    cl._lastFullPaymentTime = cl.lastFullPaymentTime();

    uint256 totalInterestAccrued = cl.totalInterestAccrued();
    uint256 totalInterestOwed = cl.totalInterestOwed();

    cl._totalInterestAccruedAtLastCheckpoint = totalInterestAccrued;
    cl._totalInterestOwedAtLastCheckpoint = totalInterestOwed;
    cl._checkpointedAsOf = block.timestamp;
  }

  /*================================================================================
  Main View Functions
  ================================================================================*/
  function lockState(CallableCreditLine storage cl) internal view returns (LockState) {
    if (
      cl._paymentSchedule.isActive() &&
      block.timestamp > cl.termStartTime() + cl._config.getDrawdownPeriodInSeconds()
    ) {
      return LockState.Unlocked;
    } else if (cl._paymentSchedule.isActive()) {
      return LockState.DrawdownPeriod;
    } else {
      return LockState.Funding;
    }
  }

  function uncalledCapitalTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint32) {
    return uint32(cl._waterfall.numTranches() - 1);
  }

  function principalOwedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256 returnedPrincipalOwed) {
    return
      cl.totalPrincipalOwedAt(timestamp).saturatingSub(
        cl._waterfall.totalPrincipalPaidAfterSettlementUpToTranche(
          cl._paymentSchedule.principalPeriodAt(timestamp)
        )
      );
  }

  function principalOwed(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.principalOwedAt(block.timestamp);
  }

  function totalPrincipalOwed(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalPrincipalOwedAt(block.timestamp);
  }

  function totalPrincipalOwedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return
      cl._waterfall.totalPrincipalDepositedUpToTranche(
        cl._paymentSchedule.principalPeriodAt(timestamp)
      );
  }

  function totalPrincipalPaid(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalPrincipalPaidAt(block.timestamp);
  }

  function totalInterestOwed(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalInterestOwedAt(block.timestamp);
  }

  /// Calculates total interest owed at a given timestamp.
  /// IT: Invalid timestamp - timestamp must be after the last checkpoint.

  function totalInterestOwedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    if (timestamp < cl._checkpointedAsOf) {
      revert ICallableLoanErrors.InputTimestampBeforeCheckpoint(timestamp, cl._checkpointedAsOf);
    }
    // After loan maturity there is no concept of additional interest. All interest accrued
    // automatically becomes interest owed.
    if (timestamp > cl.termEndTime()) {
      return cl.totalInterestAccruedAt(timestamp);
    }

    uint256 lastInterestDueTimeAtTimestamp = cl._paymentSchedule.previousInterestDueTimeAt(
      timestamp
    );

    if (lastInterestDueTimeAtTimestamp <= cl._checkpointedAsOf) {
      return cl._totalInterestOwedAtLastCheckpoint;
    } else {
      return cl.totalInterestAccruedAt(lastInterestDueTimeAtTimestamp);
    }
  }

  function interestOwed(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.interestOwedAt(block.timestamp);
  }

  /// Calculates total interest owed at a given timestamp.
  /// Assumes that principal outstanding is constant from now until the given `timestamp`.
  /// @notice IT: Invalid timestamp
  function interestOwedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    if (timestamp < cl._checkpointedAsOf) {
      revert ICallableLoanErrors.InputTimestampBeforeCheckpoint(timestamp, cl._checkpointedAsOf);
    }
    return cl.totalInterestOwedAt(timestamp).saturatingSub(cl.totalInterestPaid());
  }

  /// Interest accrued up to `block.timestamp`
  function interestAccrued(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.interestAccruedAt(block.timestamp);
  }

  /// Interest accrued up to `timestamp`
  /// PT: Past timestamp - timestamp must be now or in the future.
  function interestAccruedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    if (timestamp < block.timestamp) {
      revert ICallableLoanErrors.InputTimestampInThePast(timestamp);
    }
    return
      cl.totalInterestAccruedAt(timestamp).saturatingSub(
        Math.max(cl._waterfall.totalInterestPaid(), cl.totalInterestOwedAt(timestamp))
      );
  }

  /* Test cases
   *S = Start B = Buffer Applied At L = Late Fees Start At E = End
   *SBLE
   *SBEL
   *SLEB
   *SLBE
   *SELB
   *SEBL

   *LSEB
   *LSBE
   *LBSE(INVALID)
   *LBES(INVALID)
   *LESB(INVALID)
   *LEBS(INVALID) 

   *BSLE (INVALID)
   *BSEL (INVALID)
   *BLSE (INVALID)
   *BLES (INVALID)
   *BESL (INVALID)
   *BELS (INVALID)
   */

  /// Calculates interest accrued over the duration bounded by the `cl._checkpointedAsOf` and `end` timestamps.
  /// Assumes cl._waterfall.totalPrincipalOutstanding() for the principal balance that the interest is applied to.
  function totalInterestAccruedAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256 totalInterestAccruedReturned) {
    if (timestamp < cl._checkpointedAsOf) {
      revert ICallableLoanErrors.InputTimestampBeforeCheckpoint(timestamp, cl._checkpointedAsOf);
    }

    if (!cl._paymentSchedule.isActive()) {
      return 0;
    }
    totalInterestAccruedReturned = cl._totalInterestAccruedAtLastCheckpoint;
    uint256 firstInterestEndPoint = timestamp;
    if (cl._checkpointedAsOf > cl.termEndTime()) {} else {
      uint256 settleBalancesAt = cl._paymentSchedule.nextPrincipalDueTimeAt(cl._checkpointedAsOf);
      firstInterestEndPoint = Math.min(settleBalancesAt, timestamp);
    }

    // TODO: Test scenario where cl._lastFullPaymentTime falls on due date.
    uint256 lateFeesStartAt = Math.max(
      cl._checkpointedAsOf,
      cl._paymentSchedule.nextDueTimeAt(cl._lastFullPaymentTime) +
        (cl._config.getLatenessGracePeriodInDays() * (SECONDS_PER_DAY))
    );

    // Calculate interest accrued before balances are settled.
    totalInterestAccruedReturned += CallableLoanAccountant.calculateInterest(
      cl._checkpointedAsOf,
      firstInterestEndPoint,
      lateFeesStartAt,
      cl._waterfall.totalPrincipalOutstandingWithoutReserves(),
      cl._interestApr,
      cl._lateAdditionalApr
    );

    if (firstInterestEndPoint < timestamp) {
      // Calculate interest accrued after balances are settled.
      totalInterestAccruedReturned += CallableLoanAccountant.calculateInterest(
        firstInterestEndPoint,
        timestamp,
        lateFeesStartAt,
        cl._waterfall.totalPrincipalOutstandingWithReserves(),
        cl._interestApr,
        cl._lateAdditionalApr
      );
    }
  }

  function totalPrincipalPaidAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    uint256 alreadyPaidPrincipal = cl._waterfall.totalPrincipalPaid();

    if (!cl.isActive()) {
      return alreadyPaidPrincipal;
    }

    uint256 principalPeriodAtTimestamp = cl._paymentSchedule.principalPeriodAt(timestamp);
    uint256 principalPeriodAtCheckpoint = cl._paymentSchedule.principalPeriodAt(
      cl._checkpointedAsOf
    );

    // Unsettled principal from previous call request periods which will settle.
    uint256 reservedPrincipalWhichWillSettle = cl._waterfall.totalPrincipalReservedUpToTranche(
      principalPeriodAtTimestamp
    );

    /// If we entered a new principal period since checkpoint,
    /// we should settle reserved principal in the uncalled tranche,
    /// UNLESS
    /// Uncalled capital has already been counted due to principalPeriod being the uncalled tranche.

    if (
      principalPeriodAtTimestamp > principalPeriodAtCheckpoint &&
      principalPeriodAtTimestamp <= cl.uncalledCapitalTrancheIndex()
    ) {
      reservedPrincipalWhichWillSettle += cl
        ._waterfall
        .getTranche(cl.uncalledCapitalTrancheIndex())
        .principalReserved();
    }

    return alreadyPaidPrincipal + reservedPrincipalWhichWillSettle;
  }

  function isLate(CallableCreditLine storage cl) internal view returns (bool) {
    return cl.isLate(block.timestamp);
  }

  function isLate(CallableCreditLine storage cl, uint256 timestamp) internal view returns (bool) {
    if (cl.lockState() != LockState.Unlocked) {
      return false;
    }
    uint256 gracePeriodInSeconds = cl._config.getLatenessGracePeriodInDays() * SECONDS_PER_DAY;
    uint256 oldestUnpaidDueTime = cl._paymentSchedule.nextDueTimeAt(cl.lastFullPaymentTime());
    return
      (cl.totalPrincipalOwedAt(timestamp) > 0 || cl.totalInterestOwedAt(timestamp) > 0) &&
      timestamp > oldestUnpaidDueTime + gracePeriodInSeconds;
  }

  function totalPrincipalOutstandingWithoutReserves(
    CallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._waterfall.totalPrincipalOutstandingWithoutReserves();
  }

  /// Returns the total amount of principal outstanding - including reserved principal.
  function totalPrincipalOutstanding(
    CallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._waterfall.totalPrincipalOutstandingWithReserves();
  }

  function totalInterestAccrued(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalInterestAccruedAt(block.timestamp);
  }

  function lastFullPaymentTime(
    CallableCreditLine storage cl
  ) internal view returns (uint256 fullPaymentTime) {
    fullPaymentTime = cl._lastFullPaymentTime;
    // Similarly if !isActive(), we should bail out early since loan has not begun &&
    // paymentSchedule calls will revert.
    if (cl.lockState() != LockState.Unlocked) {
      return block.timestamp;
    }
    uint256 startPeriod = cl._paymentSchedule.periodAt(cl._checkpointedAsOf);
    uint256 currentlyActivePeriod = cl._paymentSchedule.currentPeriod();

    for (uint256 periodIndex = startPeriod; periodIndex < currentlyActivePeriod; periodIndex++) {
      uint256 periodEndTime = cl._paymentSchedule.periodEndTime(periodIndex);

      if (cl.principalOwedAt(periodEndTime) == 0 && cl.interestOwedAt(periodEndTime) == 0) {
        fullPaymentTime = periodEndTime;
      } else {
        // If we hit a period where there is still principal or interest owed, we can stop.
        break;
      }
    }
  }

  function proportionalCallablePrincipal(
    CallableCreditLine storage cl,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return
      cl._waterfall.getTranche(trancheId).proportionalPrincipalOutstandingWithoutReserves(
        principalDeposited
      );
  }

  /// Returns the index of the tranche which current call requests should be submitted to.
  function activeCallSubmissionTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint256 activeTrancheIndex) {
    uint256 currentPrincipalPeriod = cl._paymentSchedule.principalPeriodAt(block.timestamp);
    // Call requests submitted in the current principal period's lockup period are
    // submitted into the tranche of the NEXT principal period
    return cl.inLockupPeriod() ? currentPrincipalPeriod + 1 : currentPrincipalPeriod;
  }

  function proportionalInterestAndPrincipalAvailable(
    CallableCreditLine storage cl,
    uint256 trancheId,
    uint256 principal,
    uint256 feePercent
  ) internal view returns (uint256, uint256) {
    if (cl.lockState() != LockState.Unlocked) {
      return
        cl._waterfall.proportionalInterestAndPrincipalAvailable(trancheId, principal, feePercent);
    }
    bool uncalledTrancheAndNeedsSettling = trancheId == cl.uncalledCapitalTrancheIndex() &&
      cl._paymentSchedule.principalPeriodAt(cl._checkpointedAsOf) <
      cl._paymentSchedule.currentPrincipalPeriod();
    bool callRequestTrancheAndNeedsSettling = trancheId < cl.uncalledCapitalTrancheIndex() &&
      trancheId < cl._paymentSchedule.currentPrincipalPeriod();
    bool needsSettling = uncalledTrancheAndNeedsSettling || callRequestTrancheAndNeedsSettling;

    return
      needsSettling
        ? cl._waterfall.proportionalInterestAndPrincipalAvailableAfterApplyReserves(
          trancheId,
          principal,
          feePercent
        )
        : cl._waterfall.proportionalInterestAndPrincipalAvailable(trancheId, principal, feePercent);
  }

  /// Returns the balances of the given tranche - only settling principal if the tranche should be settled.
  function getSettledTrancheInfo(
    CallableCreditLine storage cl,
    uint256 trancheId
  ) internal view returns (SettledTrancheInfo memory settledTrancheInfo) {
    Tranche storage tranche = cl._waterfall.getTranche(trancheId);
    settledTrancheInfo.interestPaid = tranche.interestPaid();
    settledTrancheInfo.principalDeposited = tranche.principalDeposited();

    if (cl.isActive() && trancheId < cl._paymentSchedule.currentPrincipalPeriod()) {
      settledTrancheInfo.principalPaid = tranche.principalPaid() + tranche.principalReserved();
      settledTrancheInfo.principalReserved = 0;
    } else {
      settledTrancheInfo.principalPaid = tranche.principalPaid();
      settledTrancheInfo.principalReserved = tranche.principalReserved();
    }
  }

  function totalInterestPaid(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._waterfall.totalInterestPaid();
  }

  function totalPrincipalDeposited(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._waterfall.totalPrincipalDeposited();
  }

  function inLockupPeriod(CallableCreditLine storage cl) internal view returns (bool) {
    uint256 currentPeriod = cl._paymentSchedule.currentPeriod();
    uint256 numPeriodsPerPrincipalPeriod = cl._paymentSchedule.periodsPerPrincipalPeriod();
    return
      currentPeriod % numPeriodsPerPrincipalPeriod >=
      numPeriodsPerPrincipalPeriod - cl._numLockupPeriods;
  }

  /*================================================================================
  Payment Schedule Proxy Functions
  ================================================================================*/

  function isActive(CallableCreditLine storage cl) internal view returns (bool) {
    return cl._paymentSchedule.isActive();
  }

  function withinPrincipalGracePeriod(CallableCreditLine storage cl) internal view returns (bool) {
    return cl._paymentSchedule.withinPrincipalGracePeriodAt(block.timestamp);
  }

  function principalPeriodAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._paymentSchedule.principalPeriodAt(timestamp);
  }

  function nextPrincipalDueTime(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.nextPrincipalDueTimeAt(block.timestamp);
  }

  function nextPrincipalDueTimeAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._paymentSchedule.nextPrincipalDueTimeAt(timestamp);
  }

  function nextInterestDueTimeAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._paymentSchedule.nextInterestDueTimeAt(timestamp);
  }

  function nextDueTime(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.nextDueTimeAt(block.timestamp);
  }

  function nextDueTimeAt(
    CallableCreditLine storage cl,
    uint256 timestamp
  ) internal view returns (uint256) {
    return cl._paymentSchedule.nextDueTimeAt(timestamp);
  }

  function termStartTime(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._paymentSchedule.termStartTime();
  }

  function termEndTime(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._paymentSchedule.termEndTime();
  }

  /*================================================================================
  Static Struct Config Getters
  ================================================================================*/
  function interestApr(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._interestApr;
  }

  function lateFeeAdditionalApr(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._lateAdditionalApr;
  }

  function limit(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._limit;
  }

  function checkpointedAsOf(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._checkpointedAsOf;
  }

  function lateFeeApr(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._lateAdditionalApr;
  }

  event DepositsLocked(address indexed loan);
}
