// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../GoldfinchConfig.sol";

contract TestTheConfig {
  address public poolAddress = 0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE;
  address public clImplAddress = 0xc783df8a850f42e7F7e57013759C285caa701eB6;
  address public clFactoryAddress = 0x0afFE1972479c386A2Ab21a27a7f835361B6C0e9;
  address public fiduAddress = 0xf3c9B38c155410456b5A98fD8bBf5E35B87F6d96;
  address public creditDeskAddress = 0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4;

  function testTheEnums(address configAddress) public {
    GoldfinchConfig(configAddress).setNumber(uint256(ConfigOptions.Numbers.TransactionLimit), 1);
    GoldfinchConfig(configAddress).setNumber(uint256(ConfigOptions.Numbers.TotalFundsLimit), 2);
    GoldfinchConfig(configAddress).setNumber(uint256(ConfigOptions.Numbers.MaxUnderwriterLimit), 3);
    GoldfinchConfig(configAddress).setAddress(uint256(ConfigOptions.Addresses.Fidu), fiduAddress);
    GoldfinchConfig(configAddress).setAddress(uint256(ConfigOptions.Addresses.Pool), poolAddress);
    GoldfinchConfig(configAddress).setAddress(uint256(ConfigOptions.Addresses.CreditDesk), creditDeskAddress);
    GoldfinchConfig(configAddress).setCreditLineImplementation(clImplAddress);
    GoldfinchConfig(configAddress).setAddress(uint256(ConfigOptions.Addresses.CreditLineFactory), clFactoryAddress);
  }
}
