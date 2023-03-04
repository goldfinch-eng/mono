// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
// import {console2 as console} from "forge-std/console2.sol";
import {Tranche} from "./Tranche.sol";

using Math for uint256;

struct Waterfall {
  Tranche[] _tranches;
  uint[50] __padding;
}

using WaterfallLogic for Waterfall global;

library WaterfallLogic {
  function initialize(Waterfall storage w, uint256 nTranches) internal returns (Waterfall storage) {
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
  /// @dev OP: overpayment
  /// @dev NB: no balance
  function pay(
    Waterfall storage w,
    uint256 principalAmount,
    uint256 interestAmount,
    uint256 reserveTranchesIndexStart
  ) internal {
    uint256 existingPrincipalOutstandingWithoutReserves = w
      .totalPrincipalOutstandingWithoutReserves();
    require(existingPrincipalOutstandingWithoutReserves > 0, "NB");

    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op

    for (uint256 i = 0; i < w._tranches.length; i++) {
      Tranche storage tranche = w._tranches[i];
      uint256 proRataInterestPayment = (interestAmount *
        tranche.principalOutstandingWithoutReserves()) /
        existingPrincipalOutstandingWithoutReserves;
      uint256 principalPayment = tranche.principalOutstandingWithReserves().min(principalAmount);
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
    require(principalAmount == 0, "OP");
  }

  function drawdown(Waterfall storage w, uint256 principalAmount) internal {
    Tranche storage tranche = w.getTranche(w.numTranches() - 1);
    tranche.drawdown(principalAmount);
  }

  /**
   * @notice Move principal and paid interest from one tranche to another
   */
  function move(
    Waterfall storage w,
    uint256 principalOutstanding,
    uint256 fromTrancheId,
    uint256 toTrancheId
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
      .getTranche(fromTrancheId)
      .take(principalOutstanding);

    w.getTranche(toTrancheId).addToBalances(
      principalDeposited,
      principalPaid,
      principalReserved,
      interestPaid
    );
  }

  /**
   * @notice Withdraw principal when the tranche is not locked
            Assumes that the caller is allowed to withdraw
   */
  function withdraw(Waterfall storage w, uint256 trancheId, uint256 principalAmount) internal {
    return w._tranches[trancheId].withdraw(principalAmount);
  }

  function deposit(Waterfall storage w, uint256 trancheId, uint256 principalAmount) internal {
    return w._tranches[trancheId].deposit(principalAmount);
  }

  /// Settle all past due tranches as well as the last tranche.
  /// @param dueTrancheIndex - Index of the tranche that is due. All previous tranches are also due.
  function settleReserves(Waterfall storage w, uint256 dueTrancheIndex) internal {
    uint256 lastTrancheIndex = w.numTranches() - 1;
    Tranche storage lastTranche = w._tranches[lastTrancheIndex];
    lastTranche.settleReserves();
    for (uint256 i = 0; i <= dueTrancheIndex && i < lastTrancheIndex; i++) {
      w._tranches[i].settleReserves();
    }
  }

  function proportionalPrincipalOutstandingWithoutReserves(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return
      w.getTranche(trancheId).proportionalPrincipalOutstandingWithoutReserves(principalDeposited);
  }

  function proportionalInterestAndPrincipalAvailableAfterApplyReserves(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principalDeposited,
    uint256 feePercent
  ) internal view returns (uint256, uint256) {
    return
      w.getTranche(trancheId).proportionalInterestAndPrincipalAvailableAfterApplyingReserves(
        principalDeposited,
        feePercent
      );
  }

  /**
   * Returns the lifetime amount withdrawable
   */
  function proportionalInterestAndPrincipalAvailable(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principal,
    uint256 feePercent
  ) internal view returns (uint256, uint256) {
    return w.getTranche(trancheId).proportionalInterestAndPrincipalAvailable(principal, feePercent);
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalDeposited(Waterfall storage w) internal view returns (uint256) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint256 totalPrincipalDeposited;
    for (uint256 i = 0; i < w.numTranches(); i++) {
      totalPrincipalDeposited += w.getTranche(i).principalDeposited();
    }
    return totalPrincipalDeposited;
  }

  /// @notice Returns the total amount of interest paid to all tranches
  function totalInterestPaid(Waterfall storage w) internal view returns (uint256) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint256 totalInterestPaid;
    for (uint256 i = 0; i < w.numTranches(); i++) {
      totalInterestPaid += w.getTranche(i).interestPaid();
    }
    return totalInterestPaid;
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaidAfterSettlementUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint256 totalPrincipalPaid) {
    for (uint256 i = 0; i < trancheIndex; i++) {
      totalPrincipalPaid += w.getTranche(i).principalPaidAfterSettlement();
    }
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaid(Waterfall storage w) internal view returns (uint256) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint256 totalPrincipalPaid;
    for (uint256 i = 0; i < w.numTranches(); i++) {
      totalPrincipalPaid += w.getTranche(i).principalPaid();
    }
    return totalPrincipalPaid;
  }

  function totalPrincipalOutstandingWithoutReserves(
    Waterfall storage w
  ) internal view returns (uint256 sum) {
    uint256 sum;
    for (uint256 i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].principalOutstandingWithoutReserves();
    }
    return sum;
  }

  function totalPrincipalOutstandingWithReserves(
    Waterfall storage w
  ) internal view returns (uint256 sum) {
    uint256 sum;
    for (uint256 i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].principalOutstandingWithReserves();
    }
    return sum;
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
      sum += w._tranches[i].principalReserved();
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
      sum += w._tranches[i].principalDeposited();
    }
  }
}
