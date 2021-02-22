// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/CreditDesk.sol";

contract TestCreditDesk is CreditDesk {
  uint256 _blockNumberForTest;

  function _setTotalLoansOutstanding(uint256 amount) public {
    totalLoansOutstanding = amount;
  }

  function _setBlockNumberForTest(uint256 blockNumber) public {
    _blockNumberForTest = blockNumber;
  }

  function blockNumber() internal view override returns (uint256) {
    if (_blockNumberForTest == 0) {
      return super.blockNumber();
    } else {
      return _blockNumberForTest;
    }
  }

  function blockNumberForTest() public view returns (uint256) {
    return blockNumber();
  }
}
