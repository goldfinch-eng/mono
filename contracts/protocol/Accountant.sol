// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./CreditLine.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

/**
 * @title The Accountant
 * @notice Library for handling key financial calculations, such as interest and principal accrual.
 * @author Goldfinch
 */

library Accountant {
  using SafeMath for uint256;

  uint256 public constant INTEREST_DECIMALS = 1e8;
  uint256 public constant BLOCKS_PER_DAY = 5760;
  uint256 public constant BLOCKS_PER_YEAR = (BLOCKS_PER_DAY * 365);
  uint256 public constant LATENESS_GRACE_PERIOD = 1;
  uint256 public constant LATENESS_MAX_GRACE_PERIODS = 4;

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
    uint256 interestAccrued = calculateInterestAccrued(cl, blockNumber);
    uint256 principalAccrued = calculatePrincipalAccrued(cl, blockNumber);
    return (interestAccrued, principalAccrued);
  }

  function calculatePrincipalAccrued(CreditLine cl, uint256 blockNumber) public view returns (uint256) {
    if (blockNumber >= cl.termEndBlock()) {
      return cl.balance();
    } else {
      return 0;
    }
  }

  function calculateWritedownFor(
    CreditLine cl,
    uint256 blockNumber,
    uint256 gracePeriod
  ) public view returns (uint256, uint256) {
    uint256 amountOwedLastPeriod = calculateAmountOwedForOnePeriod(cl, blockNumber);
    if (amountOwedLastPeriod == 0) {
      return (0, 0);
    }
    uint256 totalOwed = cl.interestOwed() + cl.principalOwed();
    // Excel math: =min(1,max(0,periods_late_in_days-graceperiod_in_days)/MAX_ALLOWED_DAYS_LATE) grace_period = 30,
    // TODO: Needs to use exponential.sol
    uint256 periodsLate = totalOwed.div(amountOwedLastPeriod);

    if (periodsLate <= gracePeriod) {
      // Not late, so nothing to write down
      return (0, 0);
    }

    // TODO: Pull these from config
    uint256 writedownPercent = Math.min(1, (periodsLate - gracePeriod).div(LATENESS_MAX_GRACE_PERIODS));
    uint256 writedownAmount = cl.balance().mul(writedownPercent);
    return (writedownPercent, writedownAmount);
  }

  function calculateAmountOwedForOnePeriod(CreditLine cl, uint256 asOfBlock) public view returns (uint256) {
    // Determine theoretical interestOwed for one full period
    uint256 paymentPeriodInBlocks = cl.paymentPeriodInDays() * BLOCKS_PER_DAY;
    uint256 totalInterestPerYear = cl.balance().mul(cl.interestApr()).div(INTEREST_DECIMALS);
    uint256 interestOwed = totalInterestPerYear.mul(paymentPeriodInBlocks).div(BLOCKS_PER_YEAR);

    // If the block is beyond the loan end date, then the borrower also owes the principal
    if (asOfBlock > cl.termEndBlock()) {
      interestOwed = interestOwed + cl.balance();
    }
    return interestOwed;
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
    uint256 totalInterestPerYear = cl.balance().mul(cl.interestApr()).div(INTEREST_DECIMALS);
    return totalInterestPerYear.mul(numBlocksElapsed).div(BLOCKS_PER_YEAR);
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
