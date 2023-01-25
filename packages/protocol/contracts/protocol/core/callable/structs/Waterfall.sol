// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;
pragma experimental ABIEncoderV2;


struct Waterfall {
  Tranche[] _tranches;
}

library WaterfallLogic {
  using WaterfallLogic for Waterfall;  

  function initialize(
    Waterfall storage w,
    uint nTranches
  ) external returns (Waterfall storage) {
    w._tranches[] = new Tranches[](nTranches);
  }

  function getTranche(
    Waterfall storage w,
    uint trancheId
  ) external view returns (Tranche storage) {
    return w._tranches[trancheId];
  }

  function numTranches(
    Waterfall storage w
  ) external view returns (uint) {
    return w._tranches.length;
  }

  function pay(
    Waterfall storage w,
    uint interestAmount,
    uint principalAmount
  ) external {
    uint totalPrincipalOutstanding = w.totalPrincipalOutstanding ();

    // assume that tranches are ordered in priority. First is highest priority
    // NOTE: if we start i at the earliest unpaid tranche/quarter and end at the current quarter
    //        then we skip iterations that would result in a no-op
    // always process the last index (make it not part of the array?)
    for (uint i = 0; i < w._tranches.length; i++) {
      Tranche storage tranche = w._tranches[i];
      uint proRataInterestPayment = (interestAmount * tranche.principalOutstanding()) / totalPrincipalOutstanding;
      uint principalPayment = Math.min(tranche.principalOutstanding(), principalAmount);
    
      // subtract so that future iterations can't re-allocate a principal payment
      principalAmount -= principalPayment;

      tranche.pay(proRataInterestPayment, principalPayment);
    }
  }

  /**
   * @notice Move principal and paid interest from one tranche to another
   */
  function move(Waterfall storage w, uint principalAmount, uint fromTrancheId, uint toTrancheId) external {
    Tranche storage fromTranche = _tranches[fromTrancheId];
    Tranche storage toTranche = _tranches[toTrancheId];
    (uint principalTaken, uint interestTaken) = fromTranche.take(principalAmount);
    toTranche.addToBalances(principal, interest);(principalTaken, interestTaken); 
  }

  /**
   * @notice Withdraw principal when the tranche is not locked
            Assumes that the caller is allowed to withdraw
   */
  function withdraw(Waterfall storage w, uint trancheId, uint principalAmount) external {
    return w._tranches[trancheId].withdraw(principalAmount);
  }

  function deposit(Waterfall storage w, uint trancheId, uint principalAmount) external {
    return w._tranches[trancheId].deposit(principalAmount);
  }

  /**
   * Returns the lifetime amount withdrawable 
   */
  function cumulativeAmountWithdrawable(Waterfall storage w, uint trancheId, uint256 principal) external view returns (uint, uint) {
    return w._tranches[trancheId].cumulativeAmountWithdrawable(principal);
  }

  function totalPrincipalOutstanding(Waterfall storage w) external view returns (uint sum) {
    uint sum;
    for (uint i = 0; i < w._tranches.length; i++) {
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


library Tranche {
  function pay(Tranche storage t, uint interestAmount, uint principalAmount) external {
    assert(t._principalPaid + principalAmount <= t.principalAmount);

    t._interestPaid += interestAmount;
    t._principalPaid += principalAmount;
  }  

  function principalOutstanding(Tranche storage t) external view returns (uint) {
    return t._principalDeposited - t._principalPaid;
  }

  /**
   * @notice Withdraw principal from tranche
   * @dev reverts if interest has been paid to tranche
   */
  function withdraw(Tranche storage t, uint principal) external {
    assert(t._interestPaid == 0);
    t._principalDeposited -= principal;
  }

  /**
   * @notice remove `principal` from the Tranche and its corresponding interest
   */
  function take(Tranche storage t, uint principal) external returns (uint interestTaken) {
    // remove principal
    // remove interest
    //    removable interest = interestPaid * (principal / totalPrincipal)
    uint interestTaken = t._interestPaid * principal / t._principalDeposited;
    t._interestPaid -= interestTaken;
    return interestTaken;
  }

  // depositing into the tranche for the first time(uncalled)
  function deposit(Tranche storage t, uint principal) external {
    // SAFETY but gas cost
    assert(t._interestPaid == 0);
    t._principal += principal;
  }

  function addToBalances(Tranche storage t, uint principal, uint interest) external {
    t._principalDeposited += principal;
    t._interestPaid += interest;
  }

  function principalDeposited(Tranche storage t) external view returns (uint) {
    return t._principalDeposited;
  }

  function interestPaid(Tranche storage t) external view returns (uint) {
    return t._interestPaid;
  }

  // returns principal, interest withdrawable
  function cumulativeAmountWithdrawable(Tranche storage t, uint256 principalAmount) external view returns (uint, uint) {
    return (
      t.cumulativePrincipalWithdrawable(principalAmount),
      t.cumulativeInterestWithdrawable(principalAmount)
    );
  }

  function cumulativePrincipalWithdrawable(Tranche storage t, uint256 principalAmount) external view returns (uint) {
    return t.principalPaid() * principalAmount / t.principalDeposited();
  }

  function cumulativeInterestWithdrawable(Tranche storage t, uint256 principalAmount) external view returns (uint) {
    return t.interestPaid() * principalAmount / t.principalDeposited();
  }
}