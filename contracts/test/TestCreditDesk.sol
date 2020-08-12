// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "../CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  function _calculateAnnuityPayment(uint balance, uint interestApr, uint termInDays, uint paymentPeriodInDays) public pure returns(uint) {
    return calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays);
  }

  function _allocatePayment(uint paymentAmount, uint balance, uint totalInterestAccrued, uint totalPrincipalAccrued) public pure returns (PaymentAllocation memory) {
    return allocatePayment(paymentAmount, balance, totalInterestAccrued, totalPrincipalAccrued);
  }
}
