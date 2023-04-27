// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {FixedPoint} from "../external/FixedPoint.sol";
import {Accountant} from "../protocol/core/Accountant.sol";
import {CreditLine} from "../protocol/core/CreditLine.sol";

contract TestAccountant {
  function calculateWritedownFor(
    address creditLineAddress,
    uint256 blockNumber,
    uint256 gracePeriod,
    uint256 maxLatePeriods
  ) public view returns (uint256, uint256) {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateWritedownFor(cl, blockNumber, gracePeriod, maxLatePeriods);
  }

  function calculateAmountOwedForOneDay(
    address creditLineAddress
  ) public view returns (FixedPoint.Unsigned memory) {
    CreditLine cl = CreditLine(creditLineAddress);
    return Accountant.calculateAmountOwedForOneDay(cl);
  }
}
