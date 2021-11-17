// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../interfaces/IV2CreditLine.sol";
import "../../interfaces/ITranchedPool.sol";
import "../../external/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

/**
 * @title The Accountant
 * @notice Library for helper logic related to the tranched pool
 * @author Goldfinch
 */

library TranchedPoolHelper {
    using SafeMath for uint256;
    using FixedPoint for FixedPoint.Unsigned;
    using FixedPoint for uint256;

    uint256 public constant FP_SCALING_FACTOR = 1e18;

    function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256) {
        return totalShares == 0 ? 0 : amount.mul(FP_SCALING_FACTOR).div(totalShares);
    }

    function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256) {
        return sharePrice.mul(totalShares).div(FP_SCALING_FACTOR);
    }

    function scaleByFraction(
        uint256 amount,
        uint256 fraction,
        uint256 total
    ) public pure returns (uint256) {
        FixedPoint.Unsigned memory totalAsFixedPoint = FixedPoint.fromUnscaledUint(total);
        FixedPoint.Unsigned memory fractionAsFixedPoint = FixedPoint.fromUnscaledUint(fraction);
        return fractionAsFixedPoint.div(totalAsFixedPoint).mul(amount).div(FP_SCALING_FACTOR).rawValue;
    }

    function desiredAmountFromSharePrice(uint256 desired, uint256 actual, uint256 totalShares) public pure returns (uint256) {
        // If the desired share price is lower, then ignore it, and leave it unchanged
        if (desired < actual) {
            desired = actual;
        }
        uint256 sharePriceDifference = desired.sub(actual);
        return sharePriceToUsdc(sharePriceDifference, totalShares);
    }

    function applyToSharePrice(
        uint256 amountRemaining,
        uint256 currentSharePrice,
        uint256 desiredAmount,
        uint256 totalShares
    ) public pure returns (uint256, uint256) {
        // If no money left to apply, or don't need any changes, return the original amounts
        if (amountRemaining == 0 || desiredAmount == 0) {
            return (amountRemaining, currentSharePrice);
        }
        if (amountRemaining < desiredAmount) {
            // We don't have enough money to adjust share price to the desired level. So just use whatever amount is left
            desiredAmount = amountRemaining;
        }
        uint256 sharePriceDifference = usdcToSharePrice(desiredAmount, totalShares);
        return (amountRemaining.sub(desiredAmount), currentSharePrice.add(sharePriceDifference));
    }

    function migrateAccountingVariables(address originalCl, address newCl) public {
        IV2CreditLine originalCl = IV2CreditLine(originalCl);
        IV2CreditLine newCl = IV2CreditLine(newCl);

        // Copy over all accounting variables
        newCl.setBalance(originalCl.balance());
        newCl.setLimit(originalCl.limit());
        newCl.setInterestOwed(originalCl.interestOwed());
        newCl.setPrincipalOwed(originalCl.principalOwed());
        newCl.setTermEndTime(originalCl.termEndTime());
        newCl.setNextDueTime(originalCl.nextDueTime());
        newCl.setInterestAccruedAsOf(originalCl.interestAccruedAsOf());
        newCl.setLastFullPaymentTime(originalCl.lastFullPaymentTime());
        newCl.setTotalInterestAccrued(originalCl.totalInterestAccrued());
    }

    function closeCreditLine(address originalCl) public {
        // Close out old CL
        IV2CreditLine oldCreditLine = IV2CreditLine(originalCl);
        oldCreditLine.setBalance(0);
        oldCreditLine.setLimit(0);
        oldCreditLine.setMaxLimit(0);
    }

}