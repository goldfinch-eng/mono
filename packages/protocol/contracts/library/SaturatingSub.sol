pragma solidity >=0.8.17;

library SaturatingSub {
  /// @notice Do a - b but if that would result in underflow error, then just return 0
  function saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
    return b > a ? 0 : a - b;
  }
}
