// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// import {console2 as console} from "forge-std/console2.sol";

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {CallableLoanAccountant} from "../CallableLoanAccountant.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";

import {Tranche} from "./Tranche.sol";
import {Waterfall} from "./Waterfall.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";
import {ConfigNumbersHelper} from "../../ConfigNumbersHelper.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

using CallableCreditLineLogic for CallableCreditLine global;

struct CallableCreditLine {
  IGoldfinchConfig _config;
  uint256 _limit;
  uint256 _interestApr;
  uint256 _lateAdditionalApr;
  // TODO: Need config properties for when call request periods rollover/lock
  uint256 _checkpointedAsOf;
  uint256 _lastFullPaymentTime;
  uint256 _totalInterestOwedAtLastCheckpoint;
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
    ISchedule _schedule,
    uint _lateAdditionalApr,
    uint _limit
  ) internal {
    // NOTE: Acts as implicit initializer check - should not be able to reinitialize.
    require(cl._checkpointedAsOf == 0, "NI");
    cl._config = _config;
    cl._limit = _limit;
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
  // Scenario to test:
  // Premise - Before first due date
  // 1. Make first drawdown = 1/2 of deposits
  // 2. Some users withdraw portions of their deposits
  // 3. Borrower makes early interest repayment (also make version of test with early principal repayment)
  // 4. Some users withdraw interest
  // 5. When first due date passes, all accounting variables should produce correct values
  /// @dev ILS - Invalid loan state - Can only pay after first due date.
  function pay(
    CallableCreditLine storage cl,
    uint256 principalPayment,
    uint256 interestPayment
  ) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.InProgress || loanState == LoanState.DrawdownPeriod, "ILS");
    cl._waterfall.pay({
      principalAmount: principalPayment,
      interestAmount: interestPayment,
      reserveTranchesIndexStart: cl._paymentSchedule.currentPrincipalPeriod()
    });
    if (cl.principalOwed() == 0 && cl.interestOwed() == 0) {
      cl._lastFullPaymentTime = block.timestamp;
    }
  }

  // Scenario to test:
  // 1. Checkpoint behavior (e.g. pay)
  // 2. Drawdown 1000
  // 3. Submit call request
  // 4. Interest owed, accrued (forced redemption), and principal owed should all be accounted for correctly.
  /// @dev ILS - Invalid loan state - Can only drawdown before first due date.
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
    require(loanState == LoanState.DrawdownPeriod, "ILS");

    require(
      amount + cl._waterfall.totalPrincipalOutstandingWithReserves() <=
        cl.totalPrincipalDeposited(),
      "ED"
    );
    cl._waterfall.drawdown(amount);
  }

  /// @dev ILS - Invalid loan state - Can only submit call requests after first due date.
  function submitCall(CallableCreditLine storage cl, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.InProgress, "ILS");

    uint256 activeCallTranche = cl._paymentSchedule.currentPrincipalPeriod();
    require(
      activeCallTranche < cl.uncalledCapitalTrancheIndex(),
      "Cannot call during the last call request period"
    );

    cl._waterfall.move(amount, cl.uncalledCapitalTrancheIndex(), activeCallTranche);
  }

  /// @dev ILS - Invalid loan state - Cannot deposit after first drawdown
  /// @dev EL - Exceeds limit - Total deposit cumulative amount more than limit
  function deposit(CallableCreditLine storage cl, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.FundingPeriod, "ILS");
    require(amount + cl._waterfall.totalPrincipalDeposited() <= cl.limit(), "EL");
    cl._waterfall.deposit(cl.uncalledCapitalTrancheIndex(), amount);
  }

  /// Withdraws funds from the specified tranche.
  /// @dev ILS - Invalid loan state - Can only withdraw before first drawdown or when loan is in progress
  function withdraw(CallableCreditLine storage cl, uint256 trancheId, uint256 amount) internal {
    LoanState loanState = cl.loanState();
    require(loanState == LoanState.FundingPeriod || loanState == LoanState.InProgress, "ILS");
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
      cl._waterfall.settleReserves();
    }

    cl._lastFullPaymentTime = cl.lastFullPaymentTime();

    cl._totalInterestAccruedAtLastCheckpoint = cl.totalInterestAccruedAt(block.timestamp);
    cl._totalInterestOwedAtLastCheckpoint = cl.totalInterestOwedAt(block.timestamp);
    cl._checkpointedAsOf = block.timestamp;
  }

  /*================================================================================
  Main View Functions
  ================================================================================*/
  function loanState(CallableCreditLine storage cl) internal view returns (LoanState) {
    if (cl._paymentSchedule.isActive() && block.timestamp > cl.nextDueTimeAt(cl.termStartTime())) {
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
    return cl.totalPrincipalOwedAt(timestamp).saturatingSub(cl.totalPrincipalPaidAt(timestamp));
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
      cl._waterfall.totalPrincipalOutstandingWithReservesUpToTranche(
        cl._paymentSchedule.principalPeriodAt(timestamp)
      );
  }

  function totalPrincipalPaid(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._waterfall.totalPrincipalPaid();
  }

  function totalPrincipalOwedBeforeTranche(
    CallableCreditLine storage cl,
    uint trancheIndex
  ) internal view returns (uint principalDeposited) {
    for (uint i = 0; i < trancheIndex; i++) {
      principalDeposited += cl._waterfall.getTranche(i).principalDeposited();
    }
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
  /// IT: Invalid timestamp - timestamp must be now or in the future.
  function interestAccruedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    require(timestamp >= block.timestamp, "IT");
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
    uint256 settleBalancesAt = cl._paymentSchedule.nextPrincipalDueTimeAt(cl._checkpointedAsOf);

    // TODO: Late fees must be recalculated for every balance settlement.
    uint256 lateFeesStartAt = MathUpgradeable.max(
      cl._checkpointedAsOf,
      cl._paymentSchedule.nextDueTimeAt(cl._lastFullPaymentTime) +
        (cl._config.getLatenessGracePeriodInDays() * (SECONDS_PER_DAY))
    );

    // Calculate interest accrued before balances are settled.
    totalInterestAccruedReturned += CallableLoanAccountant.calculateInterest(
      cl._checkpointedAsOf,
      MathUpgradeable.min(settleBalancesAt, timestamp),
      lateFeesStartAt,
      cl._waterfall.totalPrincipalOutstandingWithoutReserves(),
      cl._interestApr,
      cl._lateAdditionalApr
    );

    // TODO: Actually need to iterate over all possible balance settlements.
    if (settleBalancesAt < timestamp) {
      // Calculate interest accrued after balances are settled.
      totalInterestAccruedReturned += CallableLoanAccountant.calculateInterest(
        MathUpgradeable.min(settleBalancesAt, timestamp),
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
    uint activeCallRequestPeriodAtTimestamp = cl._paymentSchedule.principalPeriodAt(timestamp);
    uint activeCallRequestPeriodAtCheckpoint = cl._paymentSchedule.principalPeriodAt(
      cl._checkpointedAsOf
    );

    // Unsettled principal from previous call request periods which will settle.
    uint reservedPrincipalWhichWillSettle = cl._waterfall.totalPrincipalReservedUpToTranche(
      activeCallRequestPeriodAtTimestamp
    );

    /// If we entered a new principal period since checkpoint,
    /// we should settle reserved principal in the uncalled tranche,
    /// UNLESS
    /// Uncalled capital has already been counted due to principalPeriod being the uncalled tranche.

    if (
      activeCallRequestPeriodAtTimestamp > activeCallRequestPeriodAtCheckpoint &&
      activeCallRequestPeriodAtTimestamp <= cl.uncalledCapitalTrancheIndex()
    ) {
      reservedPrincipalWhichWillSettle += cl
        ._waterfall
        .getTranche(cl.uncalledCapitalTrancheIndex())
        .principalReserved();
    }

    uint alreadyPaidPrincipal = cl._waterfall.totalPrincipalPaid();
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

  /// Returns the total amount of principal outstanding - not taking into account unsettled principal.
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
    // Similarly if !isActive(), we should bail out early since paymentSchedule calls will revert.
    if (cl.loanState() == LoanState.FundingPeriod) {
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

  function proportionalPrincipalOutstanding(
    CallableCreditLine storage cl,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return cl._waterfall.getTranche(trancheId).cumulativePrincipalRemaining(principalDeposited);
  }

  /// Returns the index of the tranche which current call requests should be submitted to.
  function activeCallSubmissionTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint activeTrancheIndex) {
    return cl._paymentSchedule.currentPrincipalPeriod();
  }

  function proportionalInterestAndPrincipalAvailable(
    CallableCreditLine storage cl,
    uint trancheId,
    uint256 principal
  ) internal view returns (uint, uint) {
    if (cl.loanState() == LoanState.FundingPeriod) {
      return cl._waterfall.proportionalInterestAndPrincipalAvailable(trancheId, principal);
    }
    return
      trancheId >= cl.activeCallSubmissionTrancheIndex()
        ? cl._waterfall.proportionalInterestAndPrincipalAvailable(trancheId, principal)
        : cl._waterfall.proportionalInterestAndPrincipalAvailableAfterApplyReserves(
          trancheId,
          principal
        );
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

  function termStartTime(CallableCreditLine storage cl) internal view returns (uint64) {
    return cl._paymentSchedule.startTime;
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
