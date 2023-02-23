// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
// import {console2 as console} from "forge-std/console2.sol";
import {Tranche} from "./Tranche.sol";

using MathUpgradeable for uint256;

struct Waterfall {
  Tranche[] _tranches;
  uint[50] __padding;
}

using WaterfallLogic for Waterfall global;

library WaterfallLogic {
  function initialize(Waterfall storage w, uint nTranches) internal returns (Waterfall storage) {
    for (uint i = 0; i < nTranches; i++) {
      Tranche memory t;
      w._tranches.push(t);
    }
    return w;
  }

  function getTranche(Waterfall storage w, uint trancheId) internal view returns (Tranche storage) {
    return w._tranches[trancheId];
  }

  function numTranches(Waterfall storage w) internal view returns (uint) {
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
    uint principalAmount,
    uint interestAmount,
    uint reserveTranchesIndexStart
  ) internal {
    uint totalPrincipalOutstandingWithoutReserves = w.totalPrincipalOutstandingWithoutReserves();
    require(totalPrincipalOutstandingWithoutReserves > 0, "NB");

    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op

    for (uint i = 0; i < w._tranches.length; i++) {
      Tranche storage tranche = w._tranches[i];
      uint proRataInterestPayment = (interestAmount *
        tranche.principalOutstandingWithoutReserves()) / totalPrincipalOutstandingWithoutReserves;
      uint principalPayment = tranche.principalOutstandingWithReserves().min(principalAmount);
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

  function drawdown(Waterfall storage w, uint principalAmount) internal {
    // drawdown in reverse order of payment priority
    for (uint i = w.numTranches() - 1; i > 0; i--) {
      Tranche storage tranche = w.getTranche(i);
      uint withdrawAmount = MathUpgradeable.min(tranche.principalPaid(), principalAmount);
      principalAmount -= withdrawAmount;
      tranche.drawdown(withdrawAmount);
    }
  }

  function proportionalPrincipalOutstandingWithReserves(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return w.getTranche(trancheId).proportionalPrincipalOutstandingWithReserves(principalDeposited);
  }

  /**
   * @notice Move principal and paid interest from one tranche to another
   */
  function move(
    Waterfall storage w,
    uint principalAmount,
    uint fromTrancheId,
    uint toTrancheId
  ) internal {
    (uint principalTaken, uint principalReserved, uint interestTaken) = w
      .getTranche(fromTrancheId)
      .take(principalAmount);

    return
      w.getTranche(toTrancheId).addToBalances(
        principalAmount,
        principalTaken,
        principalReserved,
        interestTaken
      );
  }

  // Submit call request to the callable pool - Proportional amount of principal paid is moved

  /**
   * @notice Withdraw principal when the tranche is not locked
            Assumes that the caller is allowed to withdraw
   */
  function withdraw(Waterfall storage w, uint trancheId, uint principalAmount) internal {
    return w._tranches[trancheId].withdraw(principalAmount);
  }

  function deposit(Waterfall storage w, uint trancheId, uint principalAmount) internal {
    return w._tranches[trancheId].deposit(principalAmount);
  }

  function settleReserves(Waterfall storage w) internal {
    for (uint i = 0; i < w.numTranches(); i++) {
      w._tranches[i].settleReserves();
    }
  }

  function proportionalInterestAndPrincipalAvailableAfterApplyReserves(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principalDeposited,
    uint feePercent
  ) internal view returns (uint256, uint) {
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
    uint trancheId,
    uint256 principal,
    uint feePercent
  ) internal view returns (uint, uint) {
    return w.getTranche(trancheId).proportionalInterestAndPrincipalAvailable(principal, feePercent);
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalDeposited(Waterfall storage w) internal view returns (uint) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint totalPrincipalDeposited;
    for (uint i = 0; i < w.numTranches(); i++) {
      totalPrincipalDeposited += w.getTranche(i).principalDeposited();
    }
    return totalPrincipalDeposited;
  }

  /// @notice Returns the total amount of interest paid to all tranches
  function totalInterestPaid(Waterfall storage w) internal view returns (uint) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint totalInterestPaid;
    for (uint i = 0; i < w.numTranches(); i++) {
      totalInterestPaid += w.getTranche(i).interestPaid();
    }
    return totalInterestPaid;
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaidAfterSettlementUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint totalPrincipalPaid) {
    for (uint i = 0; i < w.numTranches(); i++) {
      totalPrincipalPaid += w.getTranche(i).principalPaidAfterSettlement();
    }
  }

  /// @notice Returns the total amount of principal paid to all tranches
  function totalPrincipalPaid(Waterfall storage w) internal view returns (uint) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint totalPrincipalPaid;
    for (uint i = 0; i < w.numTranches(); i++) {
      totalPrincipalPaid += w.getTranche(i).principalPaid();
    }
    return totalPrincipalPaid;
  }

  function totalPrincipalOutstandingWithoutReserves(
    Waterfall storage w
  ) internal view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].principalOutstandingWithoutReserves();
    }
    return sum;
  }

  function totalPrincipalOutstandingWithReserves(
    Waterfall storage w
  ) internal view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
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
  ) internal view returns (uint sum) {
    for (uint i = 0; i < trancheIndex; i++) {
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
  ) internal view returns (uint sum) {
    for (uint i = 0; i < trancheIndex; i++) {
      sum += w._tranches[i].principalDeposited();
    }
  }
}
