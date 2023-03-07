// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
// import {console2 as console} from "forge-std/console2.sol";
import {Tranche} from "./Tranche.sol";
import {ICallableLoanErrors} from "../../../../interfaces/ICallableLoanErrors.sol";

using Math for uint256;
using WaterfallLogic for Waterfall global;

/**
 * @notice Handles the accounting of borrower obligations across all tranches.
 *         Supports
 *         - Deposit of funds (into the uncalled tranche)
 *         - Drawdown of funds  (from the uncalled tranche)
 *         - Repayment of borrowed funds - across all tranches
 *         - Withdrawal of paid funds (from the uncalled tranche)
 *         - Summing accounting variables across all tranches
 *         See "./notes.md" for notes on relationships between struct entities in Callable Loans.
 */

struct Waterfall {
  Tranche[] _tranches;
  uint[31] __padding;
}

library WaterfallLogic {
  function initialize(Waterfall storage w, uint256 nTranches) internal returns (Waterfall storage) {
    if (w._tranches.length != 0) {
      revert ICallableLoanErrors.CannotReinitialize();
    }
    for (uint256 i = 0; i < nTranches; i++) {
      Tranche memory t;
      w._tranches.push(t);
    }
    return w;
  }

  function getTranche(
    Waterfall storage w,
    uint256 trancheId
  ) internal view returns (Tranche storage) {
    return w._tranches[trancheId];
  }

  function numTranches(Waterfall storage w) internal view returns (uint256) {
    return w._tranches.length;
  }

  /// @notice apply a payment to tranches in the waterfall.
  ///         The principal payment is applied to the tranches in order of priority
  ///         The interest payment is applied to the tranches pro rata
  /// @param principalAmount: the amount of principal to apply to the tranches
  /// @param interestAmount: the amount of interest to apply to the tranches
  /// @param reserveTranchesIndexStart: After this index (inclusive), tranches will reserve principal
  function pay(
    Waterfall storage w,
    uint256 principalAmount,
    uint256 interestAmount,
    uint256 reserveTranchesIndexStart
  ) internal {
    uint256 existingPrincipalOutstandingBeforeReserves = w
      .totalPrincipalOutstandingBeforeReserves();
    if (existingPrincipalOutstandingBeforeReserves == 0) {
      revert ICallableLoanErrors.NoBalanceToPay(principalAmount);
    }

    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op

    for (uint256 i = 0; i < w._tranches.length; i++) {
      Tranche storage tranche = w.getTranche(i);
      uint256 proRataInterestPayment = (interestAmount *
        tranche.principalOutstandingBeforeReserves()) / existingPrincipalOutstandingBeforeReserves;
      uint256 principalPayment = Math.min(
        tranche.principalOutstandingAfterReserves(),
        principalAmount
      );
      // subtract so that future iterations can't re-allocate a principal payment
      principalAmount -= principalPayment;
      if (i < reserveTranchesIndexStart) {
        tranche.pay({principalAmount: principalPayment, interestAmount: proRataInterestPayment});
      } else {
        tranche.reserve({
          principalAmount: principalPayment,
          interestAmount: proRataInterestPayment
        });
      }
    }
    if (principalAmount > 0) {
      revert ICallableLoanErrors.BalanceOverpayment(
        principalAmount,
        existingPrincipalOutstandingAfterReserves
      );
    }
  }

  function drawdown(Waterfall storage w, uint256 principalAmount) internal {
    Tranche storage tranche = w.getTranche(w.uncalledCapitalTrancheIndex());
    tranche.drawdown(principalAmount);
  }

  /**
   * @notice Move principal and paid interest from one tranche to another
   */
  function move(
    Waterfall storage w,
    uint256 principalOutstanding,
    uint256 toCallRequestPeriodTrancheId
  )
    internal
    returns (
      uint256 principalDeposited,
      uint256 principalPaid,
      uint256 principalReserved,
      uint256 interestPaid
    )
  {
    (principalDeposited, principalPaid, principalReserved, interestPaid) = w
      .getTranche(w.uncalledCapitalTrancheIndex())
      .take(principalOutstanding);

    w.getTranche(toCallRequestPeriodTrancheId).addToBalances(
      principalDeposited,
      principalPaid,
      principalReserved,
      interestPaid
    );
  }

  /**
   * @notice Withdraw principal from the uncalled tranche.
            Assumes that the caller is allowed to withdraw.
   */
  function withdraw(Waterfall storage w, uint256 principalAmount) internal {
    return w.getTranche(w.uncalledCapitalTrancheIndex()).withdraw(principalAmount);
  }

  /**
   * @notice Deposits principal into the uncalled tranche.
            Assumes that the caller is allowed to deposit.
   */
  function deposit(Waterfall storage w, uint256 principalAmount) internal {
    return w.getTranche(w.uncalledCapitalTrancheIndex()).deposit(principalAmount);
  }

  /// Settle all past due tranches as well as the last tranche.
  /// @param dueTrancheIndex - Index of the tranche that is due. All previous tranches are also due.
  function settleReserves(Waterfall storage w, uint256 dueTrancheIndex) internal {
    uint256 uncalledCapitalTrancheIdx = w.uncalledCapitalTrancheIndex();
    Tranche storage uncalledCapitalTranche = w.getTranche(uncalledCapitalTrancheIdx);
    uncalledCapitalTranche.settleReserves();
    for (uint256 i = 0; i <= dueTrancheIndex && i < uncalledCapitalTrancheIdx; i++) {
      w._tranches[i].settleReserves();
    }
  }

  function uncalledCapitalTrancheIndex(Waterfall storage w) internal view returns (uint256) {
    return w.numTranches() - 1;
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalDeposited(Waterfall storage w) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < w.numTranches(); i++) {
      sum += w.getTranche(i).principalDeposited();
    }
  }

  /// @notice Returns the total amount of interest paid to all tranches
  function totalInterestPaid(Waterfall storage w) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < w.numTranches(); i++) {
      sum += w.getTranche(i).interestPaid();
    }
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaidAfterSettlementUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < trancheIndex; i++) {
      sum += w.getTranche(i).principalPaidAfterSettlement();
    }
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaid(
    Waterfall storage w
  ) internal view returns (uint256 totalPrincipalPaidSum) {
    for (uint256 i = 0; i < w.numTranches(); i++) {
      totalPrincipalPaidSum += w.getTranche(i).principalPaid();
    }
  }

  function totalPrincipalOutstandingBeforeReserves(
    Waterfall storage w
  ) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < w._tranches.length; i++) {
      sum += w.getTranche(i).principalOutstandingBeforeReserves();
    }
  }

  function totalPrincipalOutstandingAfterReserves(
    Waterfall storage w
  ) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < w._tranches.length; i++) {
      sum += w.getTranche(i).principalOutstandingAfterReserves();
    }
  }

  /**
   *
   * @param trancheIndex Exclusive upper bound (i.e. the tranche at this index is not included)
   */
  function totalPrincipalReservedUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < trancheIndex; i++) {
      sum += w.getTranche(i).principalReserved();
    }
  }

  /**
   *
   * @param trancheIndex Exclusive upper bound (i.e. the tranche at this index is not included)
   */
  function totalPrincipalDepositedUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint256 sum) {
    for (uint256 i = 0; i < trancheIndex; i++) {
      sum += w.getTranche(i).principalDeposited();
    }
  }
}
