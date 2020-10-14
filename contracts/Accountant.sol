// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./CreditLine.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library Accountant {
  using SafeMath for uint256;

  uint256 public constant INTEREST_DECIMALS = 1e18;
  uint256 public constant BLOCKS_PER_DAY = 5760;
  uint256 public constant BLOCKS_PER_YEAR = (BLOCKS_PER_DAY * 365);

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

  function calculatePrincipalAccrued(
    CreditLine cl,
    uint256 blockNumber
  ) public view returns (uint256) {
    if (blockNumber >= cl.termEndBlock()) {
      return cl.balance();
    } else {
      return 0;
    }
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
    uint256 totalInterestPerYear = (cl.balance().mul(cl.interestApr())).div(INTEREST_DECIMALS);
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
