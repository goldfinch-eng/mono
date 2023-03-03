// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// import {console2 as console} from "forge-std/console2.sol";

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {CallableLoanAccountant} from "../CallableLoanAccountant.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import {Tranche} from "./Tranche.sol";
import {Waterfall} from "./Waterfall.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";
import {ConfigNumbersHelper} from "../../ConfigNumbersHelper.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

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
  uint principalDeposited;
  uint principalPaid;
  uint principalReserved;
  uint interestPaid;
}

enum LoanState {
  FundingPeriod,
  DrawdownPeriod,
  InProgress
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

  uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;

  function initialize(
    CallableCreditLine storage cl,
    IGoldfinchConfig _config,
    uint _interestApr,
    uint _numLockupPeriods,
    ISchedule _schedule,
    uint _lateAdditionalApr,
    uint _limit
  ) internal {
    // NOTE: Acts as implicit initializer check - should not be able to reinitialize.
    require(cl._checkpointedAsOf == 0, "NI");
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
    // MT - Waterfall must have at minimum 2 tranches in order to submit call requests
    require(cl._waterfall.numTranches() >= 2, "MT");
  }

  /*================================================================================
  Main Write Functions
  ================================================================================*/
  /// @dev IS - Invalid loan state - Can only pay after drawdowns are disabled.
  function pay(
    CallableCreditLine storage cl,
    uint256 principalPayment,
    uint256 interestPayment
  ) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.InProgress, "IS");

    cl._waterfall.pay({
      principalAmount: principalPayment,
      interestAmount: interestPayment,
      reserveTranchesIndexStart: cl._paymentSchedule.currentPrincipalPeriod()
    });

    if (cl.principalOwed() == 0 && cl.interestOwed() == 0) {
      cl._lastFullPaymentTime = block.timestamp;
    }
  }

  /// @dev IS - Invalid loan state - Can only drawdown before first due date.
  /// @dev ED - Exceeds deposits - Can only drawdown as much as has been deposited.
  function drawdown(CallableCreditLine storage cl, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    if (loanState == LoanState.FundingPeriod) {
      cl._paymentSchedule.startAt(block.timestamp);
      cl._lastFullPaymentTime = block.timestamp;
      loanState = cl.loanState();
      emit DepositsLocked(address(this));
      // Scaffolding: TODO: Remove - this invariant should always be true across all tests.
      require(
        loanState == LoanState.DrawdownPeriod,
        "Scaffolding failure: Should be DrawdownPeriod"
      );
    }
    require(loanState == LoanState.DrawdownPeriod, "IS");

    require(
      amount + cl._waterfall.totalPrincipalOutstandingWithReserves() <=
        cl.totalPrincipalDeposited(),
      "ED"
    );
    cl._waterfall.drawdown(amount);
  }

  /// @dev IS - Invalid loan state - Can only submit call requests after drawdown period has ended.
  /// @dev CL - In call request lockup period.
  /// @dev LC - In last call request period, cannot submit calls.

  function submitCall(
    CallableCreditLine storage cl,
    uint256 amount
  )
    internal
    returns (
      uint principalDepositedMoved,
      uint principalPaidMoved,
      uint principalReservedMoved,
      uint interestMoved
    )
  {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.InProgress, "IS");
    uint currentPeriod = cl._paymentSchedule.currentPeriod();
    uint numPeriodsPerPrincipalPeriod = cl._paymentSchedule.periodsPerPrincipalPeriod();
    uint256 activeCallTranche = cl.activeCallSubmissionTrancheIndex();
    require(activeCallTranche < cl.uncalledCapitalTrancheIndex(), "LC");
    require(
      currentPeriod % numPeriodsPerPrincipalPeriod <
        numPeriodsPerPrincipalPeriod - cl._numLockupPeriods,
      "CL"
    );

    return cl._waterfall.move(amount, cl.uncalledCapitalTrancheIndex(), activeCallTranche);
  }

  /// @dev IS - Invalid loan state - Cannot deposit after first drawdown
  /// @dev EL - Exceeds limit - Total deposit cumulative amount more than limit
  function deposit(CallableCreditLine storage cl, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.FundingPeriod, "IS");
    require(amount + cl._waterfall.totalPrincipalDeposited() <= cl.limit(), "EL");
    cl._waterfall.deposit(cl.uncalledCapitalTrancheIndex(), amount);
  }

  /// Withdraws funds from the specified tranche.
  /// @dev IS - Invalid loan state - Can only withdraw before first drawdown or when loan is in progress
  function withdraw(CallableCreditLine storage cl, uint256 trancheId, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.FundingPeriod, "IS");
    cl._waterfall.withdraw({trancheId: trancheId, principalAmount: amount});
  }

  /// Settles payment reserves and updates the checkpointed values.
  function checkpoint(CallableCreditLine storage cl) internal {
    LoanState loanState = cl.loanState();
    if (loanState == LoanState.FundingPeriod) {
      return;
    }

    uint256 currentlyActivePeriod = cl._paymentSchedule.currentPeriod();
    uint256 activePeriodAtLastCheckpoint = cl._paymentSchedule.periodAt(cl._checkpointedAsOf);

    if (currentlyActivePeriod > activePeriodAtLastCheckpoint) {
      cl._waterfall.settleReserves(currentlyActivePeriod - 1);
    }

    cl._lastFullPaymentTime = cl.lastFullPaymentTime();

    uint totalInterestAccrued = cl.totalInterestAccrued();
    uint totalInterestOwed = cl.totalInterestOwed();

    cl._totalInterestAccruedAtLastCheckpoint = totalInterestAccrued;
    cl._totalInterestOwedAtLastCheckpoint = totalInterestOwed;
    cl._checkpointedAsOf = block.timestamp;
  }

  /*================================================================================
  Main View Functions
  ================================================================================*/
  function loanState(CallableCreditLine storage cl) internal view returns (LoanState) {
    if (
      cl._paymentSchedule.isActive() &&
      block.timestamp > cl.termStartTime() + cl._config.getDrawdownPeriodInSeconds()
    ) {
      return LoanState.InProgress;
    } else if (cl._paymentSchedule.isActive()) {
      return LoanState.DrawdownPeriod;
    } else {
      return LoanState.FundingPeriod;
    }
  }

  function uncalledCapitalTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint32) {
    return uint32(cl._waterfall.numTranches() - 1);
  }

  function principalOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint returnedPrincipalOwed) {
    return
      cl.totalPrincipalOwedAt(timestamp).saturatingSub(
        cl._waterfall.totalPrincipalPaidAfterSettlementUpToTranche(
          cl._paymentSchedule.principalPeriodAt(timestamp)
        )
      );
  }

  function principalOwed(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.principalOwedAt(block.timestamp);
  }

  function totalPrincipalOwed(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalPrincipalOwedAt(block.timestamp);
  }

  function totalPrincipalOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return
      cl._waterfall.totalPrincipalDepositedUpToTranche(
        cl._paymentSchedule.principalPeriodAt(timestamp)
      );
  }

  function totalPrincipalPaid(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.totalPrincipalPaidAt(block.timestamp);
  }

  function totalInterestOwed(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.totalInterestOwedAt(block.timestamp);
  }

  /// Calculates total interest owed at a given timestamp.
  /// IT: Invalid timestamp - timestamp must be after the last checkpoint.

  function totalInterestOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    require(timestamp >= cl._checkpointedAsOf, "IT");
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

  function interestOwed(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.interestOwedAt(block.timestamp);
  }

  /// Calculates total interest owed at a given timestamp.
  /// Assumes that principal outstanding is constant from now until the given `timestamp`.
  /// @notice IT: Invalid timestamp
  function interestOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    require(timestamp >= cl._checkpointedAsOf, "IT");
    return cl.totalInterestOwedAt(timestamp).saturatingSub(cl.totalInterestPaid());
  }

  /// Interest accrued up to `block.timestamp`
  function interestAccrued(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.interestAccruedAt(block.timestamp);
  }

  /// Interest accrued up to `timestamp`
  /// PT: Past timestamp - timestamp must be now or in the future.
  function interestAccruedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    require(timestamp >= block.timestamp, "PT");
    return
      cl.totalInterestAccruedAt(timestamp).saturatingSub(
        MathUpgradeable.max(cl._waterfall.totalInterestPaid(), cl.totalInterestOwedAt(timestamp))
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
    require(timestamp >= cl._checkpointedAsOf, "IT");
    if (!cl._paymentSchedule.isActive()) {
      return 0;
    }
    totalInterestAccruedReturned = cl._totalInterestAccruedAtLastCheckpoint;
    uint firstInterestEndPoint = timestamp;
    if (cl._checkpointedAsOf > cl.termEndTime()) {} else {
      uint256 settleBalancesAt = cl._paymentSchedule.nextPrincipalDueTimeAt(cl._checkpointedAsOf);
      firstInterestEndPoint = MathUpgradeable.min(settleBalancesAt, timestamp);
    }

    // TODO: Test scenario where cl._lastFullPaymentTime falls on due date.
    uint256 lateFeesStartAt = MathUpgradeable.max(
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
    uint timestamp
  ) internal view returns (uint) {
    uint alreadyPaidPrincipal = cl._waterfall.totalPrincipalPaid();

    if (!cl.isActive()) {
      return alreadyPaidPrincipal;
    }

    uint principalPeriodAtTimestamp = cl._paymentSchedule.principalPeriodAt(timestamp);
    uint principalPeriodAtCheckpoint = cl._paymentSchedule.principalPeriodAt(cl._checkpointedAsOf);

    // Unsettled principal from previous call request periods which will settle.
    uint reservedPrincipalWhichWillSettle = cl._waterfall.totalPrincipalReservedUpToTranche(
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
    if (cl.loanState() != LoanState.InProgress) {
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
  ) internal view returns (uint fullPaymentTime) {
    fullPaymentTime = cl._lastFullPaymentTime;
    // Similarly if !isActive(), we should bail out early since loan has not begun &&
    // paymentSchedule calls will revert.
    if (cl.loanState() != LoanState.InProgress) {
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
  ) internal view returns (uint activeTrancheIndex) {
    uint callSubmissionPeriod = cl._paymentSchedule.currentPeriod() + cl._numLockupPeriods;
    uint callSubmissionPeriodEnd = cl._paymentSchedule.periodEndTime(callSubmissionPeriod) - 1;
    return cl._paymentSchedule.principalPeriodAt(callSubmissionPeriodEnd);
  }

  function proportionalInterestAndPrincipalAvailable(
    CallableCreditLine storage cl,
    uint trancheId,
    uint256 principal,
    uint feePercent
  ) internal view returns (uint, uint) {
    if (cl.loanState() != LoanState.InProgress) {
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
    uint trancheId
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

  function totalInterestPaid(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._waterfall.totalInterestPaid();
  }

  function totalPrincipalDeposited(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._waterfall.totalPrincipalDeposited();
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
    uint timestamp
  ) internal view returns (uint) {
    return cl._paymentSchedule.principalPeriodAt(timestamp);
  }

  function nextPrincipalDueTime(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.nextPrincipalDueTimeAt(block.timestamp);
  }

  function nextPrincipalDueTimeAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._paymentSchedule.nextPrincipalDueTimeAt(timestamp);
  }

  function nextInterestDueTimeAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._paymentSchedule.nextInterestDueTimeAt(timestamp);
  }

  function nextDueTime(CallableCreditLine storage cl) internal view returns (uint) {
    return cl.nextDueTimeAt(block.timestamp);
  }

  function nextDueTimeAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._paymentSchedule.nextDueTimeAt(timestamp);
  }

  function termStartTime(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._paymentSchedule.termStartTime();
  }

  function termEndTime(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._paymentSchedule.termEndTime();
  }

  /*================================================================================
  Static Struct Config Getters
  ================================================================================*/
  function interestApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._interestApr;
  }

  function lateFeeAdditionalApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._lateAdditionalApr;
  }

  function limit(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._limit;
  }

  function checkpointedAsOf(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._checkpointedAsOf;
  }

  function lateFeeApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._lateAdditionalApr;
  }

  event DepositsLocked(address indexed loan);
}
