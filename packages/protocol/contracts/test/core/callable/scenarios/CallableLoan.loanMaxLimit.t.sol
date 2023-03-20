pragma solidity ^0.8.0;

import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";

contract CallableLoanLoanReachesMaxLimitScenarioTest is CallableLoanBaseTest {
  CallableLoan private loan;

  /*
  1. Add deposits until the loan reaches its limit
  2. Verify it rejects deposits that exceed the limit
  3. Have users withdraw so we're under the limit again
  4. Verify the loan accepts deposits again up to the limit 
  */
  function testScenarioWhereLoanReachesMaxLimit() public {}
}
