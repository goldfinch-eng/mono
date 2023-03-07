// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

enum LoanType {
  TranchedPool,
  CallableLoan
}

interface ILoanTypeProvider {
  function getLoanType() external view returns (LoanType);
}
