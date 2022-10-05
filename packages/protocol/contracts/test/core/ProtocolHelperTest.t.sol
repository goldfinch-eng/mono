// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";

import {ProtocolHelper} from "./ProtocolHelper.t.sol";

/// This test exists to help debug issues with ProtocolHelper.
/// ProtocolHelper is deployed with deployCode, which appears to swallow errors.
contract ProtocolHelperTest is Test {
  function testProtocolHelper() public {
    ProtocolHelper protocol = new ProtocolHelper(vm, address(1), address(2));
    console.logAddress(address(protocol.gfConfig()));
  }
}
