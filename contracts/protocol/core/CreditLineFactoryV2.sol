// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "./CreditLine.sol";
import "./ConfigHelper.sol";

/**
 * @title CreditLineFactoryV2
 * @notice Contract that allows us to create CreditLines, which are used in TranchedPools
 * @author Goldfinch
 */

contract CreditLineFactoryV2 is BaseUpgradeablePausable, ICreditLineFactoryV2 {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function createCreditLine() external override returns (address) {
    return deployMinimal(config.creditLineImplementationAddress());
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }

  // Stolen from:
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/ProxyFactory.sol
  function deployMinimal(address _logic) internal returns (address proxy) {
    bytes20 targetBytes = bytes20(_logic);
    // solhint-disable-next-line no-inline-assembly
    assembly {
      let clone := mload(0x40)
      mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(clone, 0x14), targetBytes)
      mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
      proxy := create(0, clone, 0x37)
    }
    return proxy;
  }
}
