// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

using TrancheLogic for Tranche global;

struct Tranche {
  uint _principalDeposited;
  uint _principalPaid;
  uint _principalReserved;
  uint _interestPaid;
  // TODO: verify that this works for upgradeability
  uint[50] __padding;
}

library TrancheLogic {
  function settleReserves(Tranche storage t) internal {
    t._principalPaid += t._principalReserved;
    t._principalReserved = 0;
  }

  function pay(Tranche storage t, uint principalAmount, uint interestAmount) internal {
    assert(
      t._principalPaid + t._principalReserved + principalAmount <=
        t.principalOutstandingWithReserves()
    );

    t._interestPaid += interestAmount;
    t._principalPaid += principalAmount;
  }

  function reserve(Tranche storage t, uint principalAmount, uint interestAmount) internal {
    assert(
      t._principalPaid + t._principalReserved + principalAmount <=
        t.principalOutstandingWithReserves()
    );

    t._interestPaid += interestAmount;
    t._principalReserved += principalAmount;
  }

  /**
   * Returns principal outstanding, omitting _principalReserve.
   */
  function principalOutstandingWithoutReserves(Tranche storage t) internal view returns (uint) {
    return t._principalDeposited - t._principalPaid;
  }

  /**
   * Returns principal outstanding, taking into account any _principalReserve.
   */
  function principalOutstandingWithReserves(Tranche storage t) internal view returns (uint) {
    return t._principalDeposited - t._principalPaid - t._principalReserved;
  }

  /**
   * @notice Withdraw principal from tranche - effectively nullifying the deposit.
   * @dev reverts if interest has been paid to tranche
   */
  function withdraw(Tranche storage t, uint principal) internal {
    assert(t._interestPaid == 0);
    t._principalDeposited -= principal;
    t._principalPaid -= principal;
  }

  /**
   * @notice remove `principal` from the Tranche and its corresponding interest
   */
  function take(
    Tranche storage t,
    uint principal
  ) internal returns (uint principalPaid, uint principalReserved, uint interestTaken) {
    require(t._principalDeposited > 0, "IT");
    // console.log("t", t._principalDeposited, t._principalPaid, t._interestPaid);
    interestTaken = (t._interestPaid * principal) / t._principalDeposited;
    // console.log("interestTaken", interestTaken);

    // Take pro rata portion of paid principal
    // console.log("t", t._principalDeposited, t._principalPaid, t._interestPaid);
    // console.log("principalPaid", principalPaid);
    principalReserved = (t._principalReserved * principal) / t._principalDeposited;
    principalPaid = (t._principalPaid * principal) / t._principalDeposited;
    t._interestPaid -= interestTaken;
    t._principalDeposited -= principal;
    t._principalReserved -= principal;
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
    uint principalPaid,
    uint principalReserved,
    uint interestPaid
  ) internal {
    t._principalDeposited += principalDeposited;
    t._principalPaid += principalPaid;
    t._principalReserved += principalReserved;
    t._interestPaid += interestPaid;
  }

  function principalDeposited(Tranche storage t) internal view returns (uint) {
    return t._principalDeposited;
  }

  /// @notice Returns the amount of principal paid to the tranche
  function principalPaid(Tranche storage t) internal view returns (uint) {
    return t._principalPaid;
  }

  /// @notice Returns the amount of principal paid to the tranche
  function principalReserved(Tranche storage t) internal view returns (uint) {
    return t._principalReserved;
  }

  /// @notice Returns the amount of principal paid + principal reserved
  function principalPaidAfterSettlement(Tranche storage t) internal view returns (uint) {
    return t._principalPaid + t._principalReserved;
  }

  function interestPaid(Tranche storage t) internal view returns (uint) {
    return t._interestPaid;
  }

  // returns principal, interest withdrawable
  function proportionalInterestAndPrincipalAvailableAfterApplyingReserves(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint, uint) {
    return (
      t.cumulativeInterestWithdrawable(principalAmount),
      t.proportionalPrincipalAvailableAfterApplyingReserves(principalAmount)
    );
  }

  function proportionalInterestAndPrincipalAvailable(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint, uint) {
    return (
      t.cumulativeInterestWithdrawable(principalAmount),
      t.cumulativePrincipalWithdrawable(principalAmount)
    );
  }

  function proportionalPrincipalAvailableAfterApplyingReserves(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint) {
    return ((t.principalPaid() + t._principalReserved) * principalAmount) / t.principalDeposited();
  }

  function cumulativePrincipalWithdrawable(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint) {
    return (t.principalPaid() * principalAmount) / t.principalDeposited();
  }

  function cumulativePrincipalRemaining(
    Tranche storage t,
    uint256 principalAmount
  ) internal view returns (uint) {
    return
      ((t.principalDeposited() - t.principalPaid()) * principalAmount) / t.principalDeposited();
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
