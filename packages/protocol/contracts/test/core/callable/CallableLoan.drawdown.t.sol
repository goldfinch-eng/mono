//TODO

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanAccessControlTest is CallableLoanBaseTest {
  function testAccessControlOwnerIsGovernance() public {
    revert();
  }
}
