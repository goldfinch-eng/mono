// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../protocol/core/callable/CallableLoan.sol";

contract TestCallableLoan is CallableLoan {
  function collectInterestAndPrincipal(uint256 interest, uint256 principal) public {
    _collectInterestAndPrincipal(interest, principal);
  }
}
