// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "../protocol/CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  uint256 blockNumberForTest;

  function _setTotalLoansOutstanding(uint256 amount) public {
    totalLoansOutstanding = amount;
  }

  function _setBlockNumberForTest(uint256 blockNumber) public {
    blockNumberForTest = blockNumber;
  }

  function blockNumber() internal view override returns (uint256) {
    if (blockNumberForTest == 0) {
      return super.blockNumber();
    } else {
      return blockNumberForTest;
    }
  }
}
