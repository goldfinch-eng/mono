// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

// import {console2 as console} from "forge-std/console2.sol";

import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {IGoldfinchConfig} from "../../../../interfaces/IGoldfinchConfig.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {CallableLoanAccountant} from "../CallableLoanAccountant.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";

import {Waterfall, WaterfallLogic, TrancheLogic, Tranche} from "./Waterfall.sol";
import {PaymentSchedule, PaymentScheduleLogic} from "../../schedule/PaymentSchedule.sol";
import {ConfigNumbersHelper} from "../../ConfigNumbersHelper.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

struct StaleCallableCreditLine {
  CallableCreditLine _cl;
}

using StaleCallableCreditLineLogic for StaleCallableCreditLine global;
using CallableCreditLineLogic for CallableCreditLine global;

library StaleCallableCreditLineLogic {
  using SaturatingSub for uint256;
  using ConfigNumbersHelper for IGoldfinchConfig;

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
    return cl.paymentSchedule().schedule;
  }

  function termStartTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.termStartTime();
  }

  function interestAccruedAsOf(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.interestAccruedAsOf();
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

  function paymentSchedule(
    StaleCallableCreditLine storage cl
  ) internal view returns (PaymentSchedule storage) {
    return cl._cl._paymentSchedule;
  }

  function totalPrincipalOutstanding(
    StaleCallableCreditLine storage cl
  ) internal view returns (uint256) {
    // TODO: For every elapsed call request period since last checkpoint, we need to settle up reserved principal.
    return cl._cl.totalPrincipalOutstanding(); // Invalid - see TODO above
  }

  /**
   * Returns the total amount of principal outstanding  - after settling any reserved principal which
   * was set aside for now elapsed call request periods.
   */
  function totalPrincipalOwed(StaleCallableCreditLine storage cl) internal view returns (uint256) {
    return
      cl._cl._waterfall.totalPrincipalOutstandingUpToTranche(
        cl.paymentSchedule().currentPrincipalPeriod()
      );
  }

  function nextDueTimeAt(
    StaleCallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl.nextDueTimeAt(timestamp);
  }

  function nextDueTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl.nextDueTimeAt(block.timestamp);
  }

  function termEndTime(StaleCallableCreditLine storage cl) internal view returns (uint) {
    return cl._cl.termEndTime();
  }
}

struct CallableCreditLine {
  IGoldfinchConfig _config;
  uint256 _limit;
  uint256 _interestApr;
  uint256 _lateAdditionalApr;
  // TODO: Need config properties for when call request periods rollover/lock
  uint256 _checkpointedAsOf;
  uint256 _bufferedPayments;
  uint256 _lastFullPaymentTime;
  uint256 _totalInterestOwed;
  uint256 _totalInterestAccruedAtLastCheckpoint;
  Waterfall _waterfall;
  PaymentSchedule _paymentSchedule;
  uint[50] __padding;
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
    require(cl._checkpointedAsOf == 0, "NI");
    cl._config = _config;
    cl._limit = _limit;
    cl._paymentSchedule = PaymentSchedule(_schedule, 0);
    cl._waterfall.initialize(_schedule.totalPrincipalPeriods());
    cl._interestApr = _interestApr;
    cl._lateAdditionalApr = _lateAdditionalApr;
    cl._checkpointedAsOf = block.timestamp;

    // Zero out cumulative/settled values
    cl._lastFullPaymentTime = 0;
    cl._totalInterestAccruedAtLastCheckpoint = 0;
    cl._totalInterestOwed = 0;
    cl._bufferedPayments = 0;
    // MT - Waterfall must have at minimum 2 tranches in order to submit call requests
    require(cl._waterfall.numTranches() >= 2, "MT");
  }

  function pay(
    CallableCreditLine storage cl,
    uint256 principalPayment,
    uint256 interestPayment
  ) internal {
    cl._waterfall.payUntil(
      principalPayment,
      interestPayment,
      cl._paymentSchedule.currentPrincipalPeriod()
    );
    if (cl.principalOwed() == 0 && cl.interestOwed() == 0) {
      cl._lastFullPaymentTime = block.timestamp;
    }
  }

  // Scenario to test:
  // 1. Checkpoint behavior (e.g. pay)
  // 2. Drawdown 1000
  // 3. Submit call request
  // 4. Interest owed, accrued (forced redemption), and principal owed should all be accounted for correctly.
  function drawdown(CallableCreditLine storage cl, uint256 amount) internal {
    if (!cl._paymentSchedule.isActive()) {
      cl._paymentSchedule.startAt(block.timestamp);
    }

    // TODO: COnditions for valid drawdown.
    require(
      amount + cl._waterfall.totalPrincipalOutstanding() <= cl._limit,
      "Cannot drawdown more than the limit"
    );
    cl._waterfall.drawdown(amount);
  }

  function submitCall(CallableCreditLine storage cl, uint256 amount) internal {
    // console.log("call 1");
    uint256 activeCallTranche = cl._paymentSchedule.currentPrincipalPeriod();
    // console.log("call 2");
    require(
      activeCallTranche < cl.uncalledCapitalTrancheIndex(),
      "Cannot call during the last call request period"
    );
    // console.log("call 3");
    // console.log("cl.uncalledCapitalTrancheIndex(): ", cl.uncalledCapitalTrancheIndex());
    // console.log("activeCallTranche: ", activeCallTranche);

    cl._waterfall.move(amount, cl.uncalledCapitalTrancheIndex(), activeCallTranche);
  }

  function deposit(CallableCreditLine storage cl, uint256 amount) internal {
    cl._waterfall.deposit(cl.uncalledCapitalTrancheIndex(), amount);
  }

  /**
   * Withdraws funds from the specified tranche.
   */
  function withdraw(CallableCreditLine storage cl, uint256 trancheId, uint256 amount) internal {
    cl._waterfall.withdraw(amount, trancheId);
  }

  /**
   * 1. Calculates interest owed up until the last interest due time.
   * 2. Applies any outstanding bufferedPayments.
   */
  function checkpoint(CallableCreditLine storage cl) internal {
    if (!cl._paymentSchedule.isActive()) {
      return;
    }
    uint256 currentlyActivePrincipalPeriod = cl._paymentSchedule.currentPrincipalPeriod();
    uint256 currentlyActivePeriod = cl._paymentSchedule.currentPeriod();

    uint256 activePrincipalPeriodAtLastCheckpoint = cl._paymentSchedule.principalPeriodAt(
      cl._checkpointedAsOf
    );
    uint256 activePeriodAtLastCheckpoint = cl._paymentSchedule.periodAt(cl._checkpointedAsOf);

    // uint256 nextDueTime = cl._paymentSchedule.nextDueTimeAt(cl._checkpointedAsOf);
    // bool needToSettleReserves = currentlyActivePrincipalPeriod >
    //   activePrincipalPeriodAtLastCheckpoint;

    // // Base case

    // for (
    //   uint periodIndex = activePeriodAtLastCheckpoint;
    //   periodIndex < currentlyActivePeriod;
    //   periodIndex++
    // ) {
    //   if (needToSettleReserves) {
    //     cl._waterfall.settleReserves();
    //   }

    //   cl._checkpointedAsOf = timeOfSettlement;

    //   if (cl.principalOwedAt(timeOfSettlement) == 0 && cl.interestOwedAt(timeOfSettlement) == 0) {
    //     cl._lastFullPaymentTime = timeOfSettlement;
    //   }

    //   activePrincipalPeriodAtLastCheckpoint = cl._paymentSchedule.principalPeriodAt(
    //     cl._checkpointedAsOf
    //   );
    //   activePeriodAtLastCheckpoint = cl._paymentSchedule.periodAt(cl._checkpointedAsOf);
    //   timeOfSettlement = cl._paymentSchedule.nextPrincipalDueTimeAt(cl._checkpointedAsOf);
    //   needToSettleReserves = activePrincipalPeriod > activePrincipalPeriodAtLastCheckpoint;
    // }

    cl._checkpointedAsOf = block.timestamp;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // VIEW STORAGE
  ////////////////////////////////////////////////////////////////////////////////
  function uncalledCapitalTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint32) {
    return uint32(cl._waterfall.numTranches() - 1);
  }

  function nextDueTime(CallableCreditLine storage cl, uint timestamp) internal view returns (uint) {
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

  // TODO: Should account for end of term.
  function principalOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint returnedPrincipalOwed) {
    require(timestamp > block.timestamp, "Cannot query past principal owed");
    uint endTrancheIndex = cl._paymentSchedule.principalPeriodAt(timestamp);
    for (uint i = cl.earliestPrincipalOutstandingTrancheIndex(); i < endTrancheIndex; i++) {
      returnedPrincipalOwed += cl._waterfall.getTranche(i).principalOutstanding();
    }
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
    uint endTrancheIndex = cl._paymentSchedule.principalPeriodAt(timestamp);
    return cl._waterfall.totalPrincipalOutstandingUpToTranche(endTrancheIndex);
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

  /**
   * Calculates total interest owed at a given timestamp.
   * IT: Invalid timestamp - timestamp must be after the last checkpoint.
   */
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

    if (timestamp > cl._paymentSchedule.previousInterestDueTimeAt(block.timestamp)) {
      return cl.totalInterestAccruedAt(timestamp);
    }

    return cl._totalInterestAccruedAtLastCheckpoint + cl.interestAccruedAt(timestamp);
  }

  function interestOwed(CallableCreditLine storage cl) internal view returns (uint) {
    cl.interestOwedAt(block.timestamp);
  }

  /**
   * Calculates total interest owed at a given timestamp.
   * Assumes that principal outstanding is constant from now until the given `timestamp`.
   */
  function interestOwedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    /// @dev IT: Invalid timestamp
    require(timestamp >= cl._checkpointedAsOf, "IT");
    return cl.totalInterestOwedAt(timestamp).saturatingSub(cl._waterfall.totalInterestPaid());
  }

  /**
   * Interest accrued up to `block.timestamp`
   */
  function interestAccrued(CallableCreditLine storage cl) internal view returns (uint) {
    cl.interestAccruedAt(block.timestamp);
  }

  /**
   * Interest accrued up to `timestamp`
   * IT: Invalid timestamp - timestamp must be now or in the future.
   */
  function interestAccruedAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    require(timestamp >= block.timestamp, "IT");
    return
      cl.totalInterestAccruedAt(timestamp) -
      ((MathUpgradeable.max(cl._waterfall.totalInterestPaid(), cl.totalInterestOwedAt(timestamp))));
  }

  /**
   * Test cases
   * S = Start B = Buffer Applied At L = Late Fees Start At E = End
    SBLE
    SBEL
    SLEB
    SLBE
    SELB
    SEBL

    LSEB
    LSBE
    LBSE(INVALID)
    LBES(INVALID)
    LESB(INVALID)
    LEBS(INVALID) 

    BSLE (INVALID)
    BSEL (INVALID)
    BLSE (INVALID)
    BLES (INVALID)
    BESL (INVALID)
    BELS (INVALID)
   */

  /**
   * Calculates interest accrued over the duration bounded by the `cl._checkpointedAsOf` and `end` timestamps.
   * Assumes cl._waterfall.totalPrincipalOutstanding() for the principal balance that the interest is applied to.
   */
  function totalInterestAccruedAt(
    CallableCreditLine storage cl,
    uint256 end
  ) internal view returns (uint256 totalInterestAccruedReturned) {
    require(end >= cl._checkpointedAsOf, "IT");
    if (!cl._paymentSchedule.isActive()) {
      return 0;
    }
    uint256 settleBalancesAt = cl._paymentSchedule.nextPrincipalDueTimeAt(cl._checkpointedAsOf);
    uint256 lateFeesStartAt = MathUpgradeable.max(
      cl._checkpointedAsOf,
      cl._paymentSchedule.nextDueTimeAt(cl._lastFullPaymentTime) +
        (cl._config.getLatenessGracePeriodInDays() * (SECONDS_PER_DAY))
    );

    // Calculate interest accrued before balances are settled.
    totalInterestAccruedReturned = CallableLoanAccountant.calculateInterest(
      cl._checkpointedAsOf,
      MathUpgradeable.min(settleBalancesAt, end),
      lateFeesStartAt,
      cl._waterfall.totalSettledPrincipalOutstanding(),
      cl._interestApr,
      cl._lateAdditionalApr
    );

    // TODO: Actually need to iterate over all possible balance settlements.
    if (cl._bufferedPayments > 0 && settleBalancesAt < end) {
      // Calculate interest accrued after balances are settled.
      totalInterestAccruedReturned += CallableLoanAccountant.calculateInterest(
        MathUpgradeable.min(settleBalancesAt, end),
        end,
        lateFeesStartAt,
        cl._waterfall.totalSettledPrincipalOutstanding(),
        cl._interestApr,
        cl._lateAdditionalApr
      );
    }
  }

  function earliestPrincipalOutstandingTrancheIndex(
    CallableCreditLine storage cl
  ) internal view returns (uint) {
    Tranche storage tranche;
    for (uint i = 0; i < cl._waterfall.numTranches(); i++) {
      tranche = cl._waterfall.getTranche(i);
      if (tranche.principalOutstanding() == 0) {
        return i;
      }
    }
  }

  function principalPeriodAt(
    CallableCreditLine storage cl,
    uint timestamp
  ) internal view returns (uint) {
    return cl._paymentSchedule.principalPeriodAt(timestamp);
  }

  function isLate(CallableCreditLine storage cl) internal view returns (bool) {
    cl.isLate(block.timestamp);
  }

  function isLate(CallableCreditLine storage cl, uint256 timestamp) internal view returns (bool) {
    uint256 gracePeriodInSeconds = cl._config.getLatenessGracePeriodInDays() * SECONDS_PER_DAY;
    uint256 oldestUnpaidDueTime = cl._paymentSchedule.nextDueTimeAt(cl._lastFullPaymentTime);
    return
      cl._waterfall.totalPrincipalOutstanding() > 0 &&
      timestamp > oldestUnpaidDueTime + gracePeriodInSeconds;
  }

  function interestApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._interestApr;
  }

  function lateFeeAdditionalApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._lateAdditionalApr;
  }

  function limit(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._limit;
  }

  function balance(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.interestOwed() + cl.principalOwed();
  }

  function totalPrincipalDeposited(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl._waterfall.totalPrincipalDeposited();
  }

  /**
   * Returns the total amount of principal outstanding - not taking into account unsettled principal.
   */
  function totalPrincipalOutstanding(
    CallableCreditLine storage cl
  ) internal view returns (uint256) {
    return cl._waterfall.totalSettledPrincipalOutstanding();
  }

  function totalInterestAccrued(CallableCreditLine storage cl) internal view returns (uint256) {
    return cl.totalInterestAccruedAt(block.timestamp);
  }

  function interestAccruedAsOf(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._checkpointedAsOf;
  }

  function lastFullPaymentTime(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._lastFullPaymentTime;
  }

  function lateFeeApr(CallableCreditLine storage cl) internal view returns (uint) {
    return cl._lateAdditionalApr;
  }

  function proportionalPrincipalOutstanding(
    CallableCreditLine storage cl,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return cl._waterfall.getTranche(trancheId).cumulativePrincipalRemaining(principalDeposited);
  }

  /*
   * Returns the index of the tranche which current call requests should be submitted to.
   */
  function activeCallSubmissionTranche(
    CallableCreditLine storage cl
  ) internal view returns (uint activeTrancheIndex) {
    return cl._paymentSchedule.currentPrincipalPeriod();
  }

  // TODO:
  /**
   * Returns the lifetime amount withdrawable
   */
  function cumulativeAmountWithdrawable(
    CallableCreditLine storage cl,
    uint trancheId,
    uint256 principal
  ) internal view returns (uint, uint) {
    return cl._waterfall.cumulativeAmountWithdrawable(trancheId, principal);
  }

  ////////////////////////////////////////////////////////////////////////////////
  // END VIEW STORAGE
  ////////////////////////////////////////////////////////////////////////////////
}
