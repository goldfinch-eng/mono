import {StakedPositionType} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  BackerRewards,
  GFI,
  Go,
  GoldfinchConfig,
  SeniorPool,
  StakingRewards,
} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import hre from "hardhat"
import {bigVal} from "../../../test/testHelpers"
import {deployFixedLeverageRatioStrategy} from "../../baseDeploy/deployFixedLeverageRatioStrategy"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"
import {deployZapper} from "../../baseDeploy/deployZapper"
import {CONFIG_KEYS} from "../../configKeys"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  ZAPPER_ROLE,
} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export type Migration260Params = {
  BackerRewards: {
    totalRewards: string
    maxInterestDollarsEligible: string
  }
  StakingRewards: {
    effectiveMultiplier: string
  }
}

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const deployEffects = await getDeployEffects({
    title: "v2.6.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/390",
  })

  console.log("Beginning v2.6.0 upgrade")

  const owner = await getProtocolOwner()
  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  const go = await getEthersContract<Go>("Go")

  // 1. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards", "SeniorPool", "StakingRewards", "CommunityRewards"],
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

  const params: Migration260Params = {
    BackerRewards: {
      totalRewards: new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02").toString(),
      maxInterestDollarsEligible: bigVal(100_000_000).toString(),
    },
    StakingRewards: {
      effectiveMultiplier: "750000000000000000",
    },
  }

  console.log(
    `Transferring ${params.BackerRewards.totalRewards} GFI to BackerRewards at address ${backerRewards.address}`
  )
  console.log("Setting StakingRewards parameters:")
  console.log(` effectiveMultipler = ${params.StakingRewards.effectiveMultiplier}`)

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

      // initialize staking rewards parameters for CurveLP positions
      await stakingRewards.populateTransaction.setEffectiveMultiplier(
        params.StakingRewards.effectiveMultiplier,
        StakedPositionType.CurveLP
      ),
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.6.0 deploy")
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
