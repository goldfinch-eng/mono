// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "../CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  function _calculateAnnuityPayment(uint balance, uint interestApr, uint termInDays, uint paymentPeriodInDays) public pure returns(uint) {
    // return calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays);
  }
}
