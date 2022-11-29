pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";

contract GasMeasurer {
  uint256 private checkpointGasLeft = 1;

  function start() external {
    checkpointGasLeft = gasleft();
  }

  function stop() external view returns (uint256) {
    uint256 checkpointGasLeft2 = gasleft();
    return checkpointGasLeft - checkpointGasLeft2 - 5411;
  }
}

contract GasMeasurerTest is Test {
  // solhint-disable func-name-mixedcase

  GasMeasurer private gasMeasurer = new GasMeasurer();

  function test_removesExtraGas_variable() public {
    gasMeasurer.start();
    uint256 gas = gasMeasurer.stop();

    assertEq(gas, 0);
  }
}
