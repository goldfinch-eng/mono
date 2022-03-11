import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  BackerRewards,
  GFI,
  Go,
  GoldfinchConfig,
  SeniorPool,
  StakingRewards,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  ZAPPER_ROLE,
} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import hre from "hardhat"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"
import {deployFixedLeverageRatioStrategy} from "../../baseDeploy/deployFixedLeverageRatioStrategy"
import {deployZapper} from "../../baseDeploy/deployZapper"
import {CONFIG_KEYS} from "../../configKeys"
import {StakedPositionType} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const deployEffects = await getDeployEffects({
    title: "v2.5 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/390",
  })

  console.log("Beginning v2.5.0 upgrade")

  const owner = await getProtocolOwner()
  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  const go = await getEthersContract<Go>("Go")
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity")

  // 1. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards", "SeniorPool", "StakingRewards", "CommunityRewards", "Go"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // 3. Deploy upgraded tranched pool
  const tranchedPool = await deployTranchedPool(deployer, {config, deployEffects})

  // 4. deploy upgraded fixed leverage ratio strategy
  const strategy = await deployFixedLeverageRatioStrategy(deployer, {config, deployEffects})

  // 5. deploy zapper
  const zapper = await deployZapper(deployer, {config, deployEffects})
  const deployedContracts = {
    tranchedPool,
    strategy,
    zapper,
  }

  const params = {
    BackerRewards: {
      totalRewards: new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02").toString(),
      maxInterestDollarsEligible: bigVal(100_000_000).toString(),
    },
    StakingRewards: {
      effectiveMultiplier: "750000000000000000",
    },
    UniqueIdentity: {
      supportedUidTypes: [0, 1, 2, 3, 4],
    },
  }

  // take 2% of the total GFI supply
  console.log("Setting BackerRewards parameters and loading in rewards")
  console.log(` totalRewards = ${params.BackerRewards.totalRewards}`)
  console.log(` maxInterestDollarsEligible = ${params.BackerRewards.maxInterestDollarsEligible}`)
  console.log(
    ` transferring ${params.BackerRewards.totalRewards} GFI to staking rewards at address ${stakingRewards.address}`
  )
  console.log("Setting StakingRewards parameters:")
  console.log(` effectiveMultipler = ${params.StakingRewards.effectiveMultiplier}`)
  console.log("Setting UniqueIdentity params:")
  console.log(` setSupportedUIDTypes = ${params.UniqueIdentity.supportedUidTypes}`)

  // 6. Add effects to deploy effects
  deployEffects.add({
    deferred: [
      // set Goldfinchconfig key for fidu usdc lp pool
      await config.populateTransaction.setAddress(CONFIG_KEYS.FiduUSDCCurveLP, MAINNET_FIDU_USDC_CURVE_LP_ADDRESS),

      // init zapper roles
      await stakingRewards.populateTransaction.initZapperRole(),
      await stakingRewards.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await seniorPool.populateTransaction.initZapperRole(),
      await seniorPool.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await go.populateTransaction.initZapperRole(),
      await go.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),

      // load GFI into backer rewards
      await gfi.populateTransaction.approve(owner, params.BackerRewards.totalRewards),
      await gfi.populateTransaction.transferFrom(owner, backerRewards.address, params.BackerRewards.totalRewards),

      // intialize backer rewards parameters
      await backerRewards.populateTransaction.setTotalRewards(params.BackerRewards.totalRewards),
      await backerRewards.populateTransaction.setMaxInterestDollarsEligible(
        params.BackerRewards.maxInterestDollarsEligible
      ),

      // initialize staking rewards parameters for CurveLP positions
      await stakingRewards.populateTransaction.setEffectiveMultiplier(
        params.StakingRewards.effectiveMultiplier,
        StakedPositionType.CurveLP
      ),

      // update supported UID types
      await uniqueIdentity.populateTransaction.setSupportedUIDTypes(params.UniqueIdentity.supportedUidTypes, [
        true,
        true,
        true,
        true,
        true,
      ]),
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.5.0 deploy")
  return {
    upgradedContracts,
    deployedContracts,
    params,
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
