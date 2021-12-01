// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./TranchedPool.sol";
import "../../interfaces/IV1CreditLine.sol";
import "../../interfaces/IMigratedTranchedPool.sol";

contract MigratedTranchedPool is TranchedPool, IMigratedTranchedPool {
  bool public migrated;

  function migrateCreditLineToV2(
    IV1CreditLine clToMigrate,
    uint256 termEndTime,
    uint256 nextDueTime,
    uint256 interestAccruedAsOf,
    uint256 lastFullPaymentTime,
    uint256 totalInterestPaid
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

    migrateDeposits(clToMigrate, totalInterestPaid);

    migrated = true;

    return newCl;
  }

  function migrateDeposits(IV1CreditLine clToMigrate, uint256 totalInterestPaid) internal {
    // Mint junior tokens to the SeniorPool, equal to current cl balance;
    require(!locked(), "Pool has been locked");
    // Hardcode to always get the JuniorTranche, since the migration case is when
    // the senior pool took the entire investment. Which we're expressing as the junior tranche
    uint256 tranche = uint256(ITranchedPool.Tranches.Junior);
    TrancheInfo storage trancheInfo = getTrancheInfo(tranche);
    require(trancheInfo.lockedUntil == 0, "Tranche has been locked");
    trancheInfo.principalDeposited = clToMigrate.limit();
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({
      tranche: tranche,
      principalAmount: trancheInfo.principalDeposited
    });
    IPoolTokens poolTokens = config.getPoolTokens();

    uint256 tokenId = poolTokens.mint(params, config.seniorPoolAddress());
    uint256 balancePaid = creditLine.limit().sub(creditLine.balance());

    // Account for the implicit redemptions already made by the Legacy Pool
    _lockJuniorCapital(poolSlices.length - 1);
    _lockPool();
    PoolSlice storage currentSlice = poolSlices[poolSlices.length - 1];
    currentSlice.juniorTranche.lockedUntil = block.timestamp - 1;
    poolTokens.redeem(tokenId, balancePaid, totalInterestPaid);

    // Simulate the drawdown
    currentSlice.juniorTranche.principalSharePrice = 0;
    currentSlice.seniorTranche.principalSharePrice = 0;

    // Set junior's sharePrice correctly
    currentSlice.juniorTranche.applyByAmount(totalInterestPaid, balancePaid, totalInterestPaid, balancePaid);
  }
}
