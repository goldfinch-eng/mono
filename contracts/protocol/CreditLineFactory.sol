// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./BaseUpgradeablePausable.sol";
import "./GoldfinchConfig.sol";

/**
 * @title CreditLineFactory
 * @notice Contract that allows us to follow the minimal proxy pattern for creating CreditLines.
 *  This saves us gas, and lets us easily swap out the CreditLine implementaton.
 * @author Goldfinch
 */

contract CreditLineFactory is BaseUpgradeablePausable {
  GoldfinchConfig public config;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function createCreditLine(bytes calldata _data) external returns (address) {
    address creditLineImplAddress = config.getAddress(uint256(ConfigOptions.Addresses.CreditLineImplementation));
    address creditLineProxy = deployMinimal(creditLineImplAddress, _data);
    return creditLineProxy;
  }

  function deployMinimal(address _logic, bytes memory _data) internal returns (address proxy) {
    /* solhint-disable */
    // From https://github.com/OpenZeppelin/openzeppelin-sdk/blob/v2.8.0/packages/lib/contracts/upgradeability/ProxyFactory.sol#L18-L35
    // Because of compiler version mismatch
    bytes20 targetBytes = bytes20(_logic);
    assembly {
      let clone := mload(0x40)
      mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(clone, 0x14), targetBytes)
      mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
      proxy := create(0, clone, 0x37)
    }

    // Only this line was changed (commented out)
    // emit ProxyCreated(address(proxy));

    if (_data.length > 0) {
      (bool success, ) = proxy.call(_data);
      require(success);
    }
    /* solhint-enable */
  }
}
