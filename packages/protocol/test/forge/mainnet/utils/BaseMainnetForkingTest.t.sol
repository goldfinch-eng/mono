pragma solidity 0.6.12;

import {Test} from "forge-std/Test.sol";
import {ISeniorPool} from "../../../../contracts/interfaces/ISeniorPool.sol";
import {IGoldfinchConfig} from "../../../../contracts/interfaces/IGoldfinchConfig.sol";
import {IGo} from "../../../../contracts/interfaces/IGo.sol";
// import {IZapper} from "../../../../contracts/interfaces/IZapper.sol";
import {IGoldfinchFactory} from "../../../../contracts/interfaces/IGoldfinchFactory.sol";
import {IFidu} from "../../../../contracts/interfaces/IFidu.sol";
import {IGFI} from "../../../../contracts/interfaces/IGFI.sol";
import {IUniqueIdentity0612 as IUniqueIdentity} from "../../../../contracts/interfaces/IUniqueIdentity0612.sol";
import {IStakingRewards} from "../../../../contracts/interfaces/IStakingRewards.sol";
import {IBackerRewards} from "../../../../contracts/interfaces/IBackerRewards.sol";

contract BaseMainnetForkingTest is Test {
  // Core Contracts
  // ================================================================================
  IGo internal go;
  IGoldfinchConfig internal config;
  IGoldfinchFactory internal factory;
  ISeniorPool internal seniorPool;
  IUniqueIdentity internal uid;
  // IZapper internal zapper;

  // Tokens
  // ================================================================================
  IFidu internal fidu;
  IGFI internal gfi;

  // Rewards contracts
  // ================================================================================
  IBackerRewards internal backerRewards;
  IStakingRewards internal stakingRewards;

  function setUp() public virtual {
    go = IGo(vm.envAddress("GO_ADDRESS"));
    config = IGoldfinchConfig(vm.envAddress("GOLDFINCH_CONFIG_ADDRESS"));
    factory = IGoldfinchFactory(vm.envAddress("GOLDFINCH_FACTORY_ADDRESS"));
    seniorPool = ISeniorPool(vm.envAddress("SENIOR_POOL_ADDRESS"));
    uid = IUniqueIdentity(vm.envAddress("UID_ADDRESS"));
    // zapper = Zapper(vm.envAddress("ZAPPER_ADDRESS"));

    fidu = IFidu(vm.envAddress("FIDU_ADDRESS"));
    gfi = IGFI(vm.envAddress("GFI_ADDRESS"));

    backerRewards = IBackerRewards(vm.envAddress("BACKER_REWARDS_ADDRESS"));
    stakingRewards = IStakingRewards(vm.envAddress("STAKING_REWARDS_ADDRESS"));
  }
}
