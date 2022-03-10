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

  // TODO(PR): renumber these steps
  // TODO(PR): log out parameters
  // 2. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards", "SeniorPool", "StakingRewards", "CommunityRewards", "Go"],
  })

  // 3. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // 1. Deploy upgraded tranched pool
  const tranchedPool = await deployTranchedPool(deployer, {config, deployEffects})

  // 2. deploy upgraded fixed leverage ratio strategy
  const strategy = await deployFixedLeverageRatioStrategy(deployer, {config, deployEffects})

  // 3. deploy zapper
  const zapper = await deployZapper(deployer, {config, deployEffects})
  const deployedContracts = {
    tranchedPool,
    strategy,
    zapper,
  }

  // take 2% of the total GFI supply
  const totalRewards = new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02").toString()
  const maxInterestDollarsEligible = bigVal(100_000_000).toString()
  console.log("Setting backer rewards parameters and loading in rewards")
  console.log(` totalRewards: ${totalRewards}`)
  console.log(` maxInterestDollarsEligible : ${maxInterestDollarsEligible}`)

  // 4. Load backer rewards
  deployEffects.add({
    deferred: [
      await config.populateTransaction.setAddress(CONFIG_KEYS.FiduUSDCCurveLP, MAINNET_FIDU_USDC_CURVE_LP_ADDRESS),
      await stakingRewards.populateTransaction.initZapperRole(),
      await stakingRewards.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await seniorPool.populateTransaction.initZapperRole(),
      await seniorPool.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await go.populateTransaction.initZapperRole(),
      await go.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await gfi.populateTransaction.approve(owner, totalRewards.toString()),
      await gfi.populateTransaction.transferFrom(owner, backerRewards.address, totalRewards),
      await backerRewards.populateTransaction.setTotalRewards(totalRewards.toString()),
      await backerRewards.populateTransaction.setMaxInterestDollarsEligible(maxInterestDollarsEligible),
      await stakingRewards.populateTransaction.setEffectiveMultiplier("750000000000000000", StakedPositionType.CurveLP),
      await uniqueIdentity.populateTransaction.setSupportedUIDTypes([0, 1, 2, 3, 4], [true, true, true, true, true]),
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.5.0 deploy")
  return {
    upgradedContracts,
    deployedContracts,
    params: {
      backerRewards: {
        totalRewards,
        maxInterestDollarsEligible,
      },
    },
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
