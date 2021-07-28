// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./TranchedPool.sol";
import "../../interfaces/IV1CreditLine.sol";
import "../../interfaces/IMigratedTranchedPool.sol";

contract MigratedTranchedPool is TranchedPool, IMigratedTranchedPool {
  bool public migrated;

  function migrateCreditLine(
    IV1CreditLine clToMigrate,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid,
    uint256 totalPrincipalPaid
  ) external override returns (IV2CreditLine) {
    require(msg.sender == config.creditDeskAddress(), "Only credit desk can call this");
    require(!migrated, "Already migrated");

    // Set accounting state vars.
    IV2CreditLine newCl = creditLine;
    newCl.setBalance(clToMigrate.balance());
    newCl.setInterestOwed(clToMigrate.interestOwed());
    newCl.setPrincipalOwed(clToMigrate.principalOwed());
    newCl.setTermEndTime(termEndTime);
    newCl.setNextDueTime(nextDueTime);
    newCl.setInterestAccruedAsOf(interestAccruedAsOf);
    newCl.setLastFullPaymentTime(lastFullPaymentTime);
    newCl.setTotalInterestAccrued(totalInterestPaid.add(clToMigrate.interestOwed()));

    migrateDeposits(clToMigrate, totalInterestPaid, totalPrincipalPaid);

    migrated = true;

    return newCl;
  }

  function migrateDeposits(
    IV1CreditLine clToMigrate,
    uint256 totalInterestPaid,
    uint256 totalPrincipalPaid
  ) internal {
    // Mint junior tokens to the SeniorFund, equal to current cl balance;
    require(!locked(), "Pool has been locked");
    // Hardcode to always get the JuniorTranche, since the migration case is when
    // the senior pool took the entire investment. Which we're expressing as the junior tranche
    uint256 tranche = uint256(ITranchedPool.Tranches.Junior);
    uint256 amount = clToMigrate.balance();
    TrancheInfo storage trancheInfo = getTrancheInfo(tranche);
    require(trancheInfo.lockedUntil == 0, "Tranche has been locked");
    trancheInfo.principalDeposited += amount;
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({tranche: tranche, principalAmount: amount});
    IPoolTokens poolTokens = config.getPoolTokens();

    uint256 tokenId = poolTokens.mint(params, config.seniorFundAddress());

    // Account for the implicit redemptions already made by the Legacy Pool
    poolTokens.redeem(tokenId, totalPrincipalPaid, totalInterestPaid);
    _lockJuniorCapital();
    _lockPool();

    // Simulate the drawdown
    uint256 amountRemaining = creditLine.limit().sub(creditLine.balance());
    juniorTranche.principalSharePrice = calculateExpectedSharePrice(amountRemaining, juniorTranche);
    seniorTranche.principalSharePrice = 0;

    // Set junior's sharePrice correctly
    applyToTrancheByAmount(totalInterestPaid, totalPrincipalPaid, totalInterestPaid, totalPrincipalPaid, juniorTranche);
  }
}
