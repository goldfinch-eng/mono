// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./CreditLine.sol";
import "./external/FPMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library Accountant {
    using SafeMath for uint256;

    uint256 public constant interestDecimals = 1e18;
    uint256 public constant blocksPerDay = 5760;
    uint256 public constant blocksPerYear = (blocksPerDay * 365);

    struct PaymentAllocation {
        uint256 interestPayment;
        uint256 principalPayment;
        uint256 additionalBalancePayment;
    }

    function calculateInterestAndPrincipalAccrued(CreditLine cl, uint256 blockNumber)
        public
        view
        returns (uint256, uint256)
    {
        uint256 totalPayment = calculateAnnuityPayment(
            cl.balance(),
            cl.interestApr(),
            cl.termInDays(),
            cl.paymentPeriodInDays()
        );
        uint256 interestAccrued = calculateInterestAccrued(cl, blockNumber);
        uint256 principalAccrued = calculatePrincipalAccrued(cl, totalPayment, interestAccrued, blockNumber);
        return (interestAccrued, principalAccrued);
    }

    function calculatePrincipalAccrued(
        CreditLine cl,
        uint256 periodPayment,
        uint256 interestAccrued,
        uint256 blockNumber
    ) public view returns (uint256) {
        uint256 blocksPerPaymentPeriod = blocksPerDay * cl.paymentPeriodInDays();
        // Math.min guards against overflow. See comment in the calculateInterestAccrued for further explanation.
        uint256 lastUpdatedBlock = Math.min(blockNumber, cl.lastUpdatedBlock());
        uint256 numBlocksElapsed = blockNumber.sub(lastUpdatedBlock);
        int128 fractionOfPeriod = FPMath.divi(int256(numBlocksElapsed), int256(blocksPerPaymentPeriod));
        uint256 periodPaymentFraction = uint256(FPMath.muli(fractionOfPeriod, int256(periodPayment)));
        return periodPaymentFraction.sub(interestAccrued);
    }

    function calculateInterestAccrued(CreditLine cl, uint256 blockNumber) public view returns (uint256) {
        // We use Math.min here to prevent integer overflow (ie. go negative) when calculating
        // numBlocksElapsed. Typically this shouldn't be possible, because
        // the lastUpdatedBlock couldn't be *after* the current blockNumber. However, when assessing
        // we allow this function to be called with a past block number, which raises the possibility
        // of overflow.
        // This use of min should not generate incorrect interest calculations, since
        // this functions purpose is just to normalize balances, and  will be called any time
        // a balance affecting action takes place (eg. drawdown, repayment, assessment)
        uint256 lastUpdatedBlock = Math.min(blockNumber, cl.lastUpdatedBlock());

        uint256 numBlocksElapsed = blockNumber.sub(lastUpdatedBlock);
        uint256 totalInterestPerYear = (cl.balance().mul(cl.interestApr())).div(interestDecimals);
        return totalInterestPerYear.mul(numBlocksElapsed).div(blocksPerYear);
    }

    function calculateAnnuityPayment(
        uint256 balance,
        uint256 interestApr,
        uint256 termInDays,
        uint256 paymentPeriodInDays
    ) public pure returns (uint256) {
        /*
    This is the standard amortization formula for an annuity payment amount.
    See: https://en.wikipedia.org/wiki/Amortization_calculator

    The specific formula we're interested in can be expressed as:
    `balance * (periodRate / (1 - (1 / ((1 + periodRate) ^ periods_per_term))))`

    FPMath is a library designed for emulating floating point numbers in solidity.
    At a high level, we are just turning all our uint256 numbers into floating points and
    doing the formula above, and then turning it back into an int64 at the end.
    */

        // Components used in the formula
        uint256 periodsPerTerm = termInDays / paymentPeriodInDays;
        int128 one = FPMath.fromInt(int256(1));
        int128 annualRate = FPMath.divi(int256(interestApr), int256(interestDecimals));
        int128 dailyRate = FPMath.div(annualRate, FPMath.fromInt(int256(365)));
        int128 periodRate = FPMath.mul(dailyRate, FPMath.fromInt(int256(paymentPeriodInDays)));
        int128 termRate = FPMath.pow(FPMath.add(one, periodRate), periodsPerTerm);

        int128 denominator = FPMath.sub(one, FPMath.div(one, termRate));
        if (denominator == 0) {
            return balance / periodsPerTerm;
        }
        int128 paymentFractionFP = FPMath.div(periodRate, denominator);
        uint256 paymentFraction = uint256(FPMath.muli(paymentFractionFP, int256(1e18)));

        return (balance * paymentFraction) / 1e18;
    }

    function allocatePayment(
        uint256 paymentAmount,
        uint256 balance,
        uint256 interestOwed,
        uint256 principalOwed
    ) public pure returns (PaymentAllocation memory) {
        uint256 paymentRemaining = paymentAmount;
        uint256 interestPayment = Math.min(interestOwed, paymentRemaining);
        paymentRemaining = paymentRemaining.sub(interestPayment);

        uint256 principalPayment = Math.min(principalOwed, paymentRemaining);
        paymentRemaining = paymentRemaining.sub(principalPayment);

        uint256 balanceRemaining = balance.sub(principalPayment);
        uint256 additionalBalancePayment = Math.min(paymentRemaining, balanceRemaining);

        return
            PaymentAllocation({
                interestPayment: interestPayment,
                principalPayment: principalPayment,
                additionalBalancePayment: additionalBalancePayment
            });
    }
}
