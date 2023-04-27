pragma solidity 0.6.12;

import {BaseMainnetForkingTest} from "./utils/BaseMainnetForkingTest.t.sol";

contract SeniorPoolMainnetForkingTest is BaseMainnetForkingTest {
  function setUp() public override {
    super.setUp();
  }

  function testSharePriceDoesntRevert() public view {
    seniorPool.sharePrice();
  }
}
