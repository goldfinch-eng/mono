import {Test} from "forge-std/Test.sol";

contract SkipHandler is Test {
  // Also exposes `skip` via Test

  function skipUpTo7Days(uint256 skipAmount) public {
    skipAmount = bound(skipAmount, 0, 7 days);
    skip(skipAmount);
  }

  function skipUpTo100Days(uint256 skipAmount) public {
    skipAmount = bound(skipAmount, 0, 100 days);
    skip(skipAmount);
  }
}
