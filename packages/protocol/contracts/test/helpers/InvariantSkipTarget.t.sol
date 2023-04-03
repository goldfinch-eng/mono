import {Test} from "forge-std/Test.sol";

contract InvariantSkipTarget is Test {
  // Also exposes `skip` via Test

  function skipUpToSevenDays(uint256 skipAmount) public {
    skipAmount = bound(skipAmount, 0, 7 days);
    skip(skipAmount);
  }
}
