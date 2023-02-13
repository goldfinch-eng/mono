// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {console2 as console} from "forge-std/console2.sol";

using MathUpgradeable for uint256;

struct Waterfall {
  Tranche[] _tranches;
  uint[50] __padding;
}

using WaterfallLogic for Waterfall global;
using WaterfallLogic for Waterfall global;

library WaterfallLogic {
  using WaterfallLogic for Waterfall;
  using TrancheLogic for Tranche;

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
  function payUntil(
    Waterfall storage w,
    uint interestAmount,
    uint principalAmount,
    uint trancheIndex
  ) internal returns (uint principalNotApplied) {
    uint totalPrincipalOutstanding = w.totalPrincipalOutstanding();

    console.log("payUntil: interestAmount", interestAmount);
    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op
    // always process the last index (make it not part of the array?)
    for (uint i = 0; i < w._tranches.length; i++) {
      console.log("i: ", i);
      Tranche storage tranche = w._tranches[i];
      console.log("After getting tranche");
      console.log(interestAmount);
      console.log(totalPrincipalOutstanding);
      console.log(tranche.principalOutstanding());
      console.log(tranche.principalOutstanding() * interestAmount);
      uint proRataInterestPayment = (interestAmount * tranche.principalOutstanding()) /
        totalPrincipalOutstanding;
      console.log("principalPayment");
      uint principalPayment = i < trancheIndex
        ? tranche.principalOutstanding().min(principalAmount)
        : 0;
      // subtract so that future iterations can't re-allocate a principal payment
      principalAmount -= principalPayment;
      console.log("tranche pay");
      console.log(proRataInterestPayment);
      console.log(principalPayment);
      tranche.pay(proRataInterestPayment, principalPayment);
    }

    return principalAmount;
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
    console.log("move1");
    (uint principalTaken, uint interestTaken) = w.getTranche(fromTrancheId).take(principalAmount);
    console.log("move2");
    return w.getTranche(toTrancheId).addToBalances(principalAmount, principalTaken, interestTaken);
  }

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

  /**
   * Returns the lifetime amount withdrawable
   */
  function cumulativeAmountWithdrawable(
    Waterfall storage w,
    uint trancheId,
    uint256 principal
  ) internal view returns (uint, uint) {
    return w._tranches[trancheId].cumulativeAmountWithdrawable(principal);
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
  function totalPrincipalPaid(Waterfall storage w) internal view returns (uint) {
    // TODO(will): this can be optimized by storing the aggregate amount paid
    //       as a storage var and updating when the tranches are paid
    uint totalPrincipalPaid;
    for (uint i = 0; i < w.numTranches(); i++) {
      totalPrincipalPaid += w.getTranche(i).principalPaid();
    }
    return totalPrincipalPaid;
  }

  function totalPrincipalOutstanding(Waterfall storage w) internal view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
      sum += w._tranches[i].principalOutstanding();
    }
    return sum;
  }

  /**
   *
   * @param trancheIndex Exclusive upper bound (i.e. the tranche at this index is not included)
   */
  function totalPrincipalOwedUpToTranche(
    Waterfall storage w,
    uint256 trancheIndex
  ) internal view returns (uint sum) {
    console.log("totalPrincipalOwedUpToTranche");
    uint sum;
    for (uint i = 0; i < trancheIndex; i++) {
      console.log("i", i);
      console.log("w._tranches[i].principalOutstanding()", w._tranches[i].principalOutstanding());
      sum += w._tranches[i].principalOutstanding();
    }
    return sum;
  }
}

struct Tranche {
  uint _principalDeposited;
  uint _principalPaid;
  uint _interestPaid;
  // TODO: verify that this works for upgradeability
  uint[50] __padding;
}

library TrancheLogic {
  using TrancheLogic for Tranche;

  function pay(Tranche storage t, uint interestAmount, uint principalAmount) internal {
    assert(t._principalPaid + principalAmount <= t.principalOutstanding());

    t._interestPaid += interestAmount;
    t._principalPaid += principalAmount;
  }

  function principalOutstanding(Tranche storage t) internal view returns (uint) {
    return t._principalDeposited - t._principalPaid;
  }

  /**
   * @notice Withdraw principal from tranche
   * @dev reverts if interest has been paid to tranche
   */
  function withdraw(Tranche storage t, uint principal) internal {
    assert(t._interestPaid == 0);
    t._principalDeposited -= principal;
  }

  /**
   * @notice remove `principal` from the Tranche and its corresponding interest
   */
  function take(
    Tranche storage t,
    uint principal
  ) internal returns (uint principalPaid, uint interestTaken) {
    require(t._principalDeposited > 0, "IT");
    console.log("t", t._principalDeposited, t._principalPaid, t._interestPaid);
    interestTaken = (t._interestPaid * principal) / t._principalDeposited;
    console.log("interestTaken", interestTaken);

    // Take pro rata portion of paid principal
    console.log("t", t._principalDeposited, t._principalPaid, t._interestPaid);
    console.log("principalPaid", principalPaid);
    principalPaid = (t._principalPaid * principal) / t._principalDeposited;
    t._interestPaid -= interestTaken;
    t._principalDeposited -= principal;

    t._principalPaid -= principalPaid;
  }

  // depositing into the tranche for the first time(uncalled)
  function deposit(Tranche storage t, uint principal) internal {
    // SAFETY but gas cost
    assert(t._interestPaid == 0);
    t._principalDeposited += principal;
    // NOTE: this is so that principalOutstanding = 0 before drawdown
    t._principalPaid += principal;
  }

  function addToBalances(
    Tranche storage t,
    uint principalDeposited,
    uint interestPaid,
    uint principalPaid
  ) internal {
    t._principalDeposited += principalDeposited;
    t._interestPaid += interestPaid;
    t._principalPaid += principalPaid;
  }

  function principalDeposited(Tranche storage t) internal view returns (uint) {
    return t._principalDeposited;
  }

  /// @notice Returns the amount of principal paid to the tranche
  function principalPaid(Tranche storage t) internal view returns (uint) {
    return t._principalPaid;
  }

  function interestPaid(Tranche storage t) internal view returns (uint) {
    return t._interestPaid;
  }

  // returns principal, interest withdrawable
  function cumulativeAmountWithdrawable(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint, uint) {
    return (
      t.cumulativePrincipalWithdrawable(principalAmount),
      t.cumulativeInterestWithdrawable(principalAmount)
    );
  }

  function cumulativePrincipalWithdrawable(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint) {
    return (t.principalPaid() * principalAmount) / t.principalDeposited();
  }

  function cumulativeInterestWithdrawable(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint) {
    return (t.interestPaid() * principalAmount) / t.principalDeposited();
  }

  function drawdown(Tranche storage t, uint principalAmount) internal {
    require(principalAmount <= t._principalPaid);
    t._principalPaid -= principalAmount;
  }
}
