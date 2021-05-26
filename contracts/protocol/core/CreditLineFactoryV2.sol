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
    CreditLine newCreditLine = new CreditLine();
    return address(newCreditLine);
  }

  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
  }
}
