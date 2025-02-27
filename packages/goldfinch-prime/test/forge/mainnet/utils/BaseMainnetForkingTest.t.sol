// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {IGoldfinchConfig} from "../../../../contracts/interfaces/IGoldfinchConfig.sol";
import {IGo} from "../../../../contracts/interfaces/IGo.sol";
import {IUniqueIdentity} from "../../../../contracts/interfaces/IUniqueIdentity.sol";

contract BaseMainnetForkingTest is Test {
  // Core Contracts
  // ================================================================================
  IGo internal go;
  IGoldfinchConfig internal config;
  IUniqueIdentity internal uid;

  function setUp() public virtual {
    go = IGo(vm.envAddress("GO_ADDRESS"));
    config = IGoldfinchConfig(vm.envAddress("GOLDFINCH_CONFIG_ADDRESS"));
    uid = IUniqueIdentity(vm.envAddress("UID_ADDRESS"));
  }
}
