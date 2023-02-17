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

  /// @notice apply a payment. Principal payments are only applied to tranches below `trancheIndex`
  /// @dev op: overpayment
  function payUntil(
    Waterfall storage w,
    uint interestAmount,
    uint principalAmount,
    uint trancheIndex
  ) internal {
    uint totalPrincipalOutstanding = w.totalPrincipalOutstanding();
    uint totalSettledPrincipalOutstanding = w.totalSettledPrincipalOutstanding();

    // console.log("payUntil: interestAmount", interestAmount);
    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op
    // always process the last index (make it not part of the array?)
    for (uint i = 0; i < w._tranches.length; i++) {
      // console.log("i: ", i);
      Tranche storage tranche = w._tranches[i];
      // console.log("After getting tranche");
      // console.log(interestAmount);
      // console.log(totalPrincipalOutstanding);
      uint proRataInterestPayment = (interestAmount * tranche.settledPrincipalOutstanding()) /
        totalSettledPrincipalOutstanding;
      // console.log("principalPayment");
      uint principalPayment = i < trancheIndex
        ? tranche.principalOutstanding().min(principalAmount)
        : 0;
      // subtract so that future iterations can't re-allocate a principal payment
      principalAmount -= principalPayment;
      // console.log("tranche pay");
      // console.log(proRataInterestPayment);
      // console.log(principalPayment);
      tranche.pay(proRataInterestPayment, principalPayment);
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

  function proportionalPrincipalOutstanding(
    Waterfall storage w,
    uint256 trancheId,
    uint256 principalDeposited
  ) internal view returns (uint256) {
    return w.getTranche(trancheId).cumulativePrincipalRemaining(principalDeposited);
  }

  // function drawdown(Waterfall storage w, uint principalAmount) internal {
  //   // drawdown pro rata
  //   uint totalPrincipalPaid = w.totalPrincipalPaid();

  //   for (uint i = 0; i < w.numTranches(); i++) {
  //     Tranche storage tranche = w.getTranche(i);
  //     uint perTranchePrincipalAmount = (principalAmount * tranche.totalPrincipalPaid()) /
  //       totalPrincipalPaid;
  //     tranche.drawdown(perTranchePrincipalAmount);
  //   }
  // }

  /**
   * @notice Move principal and paid interest from one tranche to another
   */
  function move(
    Waterfall storage w,
    uint principalAmount,
    uint fromTrancheId,
    uint toTrancheId
  ) internal {
    // console.log("move1");
    (uint principalTaken, uint principalReserved, uint interestTaken) = w
      .getTranche(fromTrancheId)
      .take(principalAmount);
    // console.log("move2");
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
    uint256 principalDeposited
  ) internal view returns (uint256, uint) {
    return
      w.getTranche(trancheId).proportionalInterestAndPrincipalAvailableAfterApplyingReserves(
        principalDeposited
      );
  }

  /**
   * Returns the lifetime amount withdrawable
   */
  function proportionalInterestAndPrincipalAvailable(
    Waterfall storage w,
    uint trancheId,
    uint256 principal
  ) internal view returns (uint, uint) {
    return w.getTranche(trancheId).proportionalInterestAndPrincipalAvailable(principal);
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

  function totalSettledPrincipalOutstanding(Waterfall storage w) internal view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].settledPrincipalOutstanding();
    }
    return sum;
  }

  function totalPrincipalOutstanding(Waterfall storage w) internal view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].principalOutstanding();
    }
    return sum;
  }

  function totalReservedPrincipalUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint sum) {
    for (uint i = 0; i < trancheIndex; i++) {
      // console.log("i", i);
      // console.log("w._tranches[i].principalOutstanding()", w._tranches[i].principalOutstanding());
      sum += w._tranches[i].principalReserved();
    }
  }

  /**
   *
   * @param trancheIndex Exclusive upper bound (i.e. the tranche at this index is not included)
   */
  function totalPrincipalOutstandingUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint sum) {
    // console.log("totalPrincipalOwedUpToTranche");
    for (uint i = 0; i < trancheIndex; i++) {
      // console.log("i", i);
      // console.log("w._tranches[i].principalOutstanding()", w._tranches[i].principalOutstanding());
      sum += w._tranches[i].principalOutstanding();
    }
  }

  function settledPrincipalOustandingUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint sum) {
    for (uint i = 0; i < trancheIndex; i++) {
      sum += w._tranches[i].settledPrincipalOutstanding();
    }
  }

  /**
   * Up to `trancheIndex`, return the first tranche which has not fully paid principalDeposited after settling reserves.
   * @param trancheIndex Exclusive upper bound (i.e. the tranche at this index is not included)
   */
  function lastSettledTrancheUpToTranche(
    Waterfall storage w,
    uint trancheIndex
  ) public view returns (uint256) {
    for (uint i = 0; i < trancheIndex; i++) {
      if (w._tranches[i].settledPrincipalOutstanding() > 0) {
        return i;
      }
    }
    return trancheIndex;
  }
}
