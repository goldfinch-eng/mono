import {deployPoolRewards, deployTranchedPool, deployConfig} from "../../baseDeploy"
import {
  ContractDeployer,
  ContractUpgrader,
  getDeployedContract,
  getProtocolOwner,
  getTruffleContract,
} from "../../deployHelpers"
import hre from "hardhat"
import {GoldfinchConfigInstance} from "../../../typechain/truffle"
import {DeployEffects} from "../deployEffects"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {migrateToNewConfig} from "../../mainnetForkingHelpers"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const upgradedContracts = await upgrader.upgrade({contracts: ["SeniorPool", "Go", "UniqueIdentity", "PoolTokens"]})

  // Need to deploy and migrate to a new config
  await deployConfig(deployer)
  await migrateToNewConfig(upgradedContracts, [
    "CreditDesk", // can remove?
    "CreditLine",
    "Fidu",
    "FixedLeverageRatioStrategy",
    "Go",
    "MigratedTranchedPool", // can remove?
    "Pool", // can remove?
    "PoolTokens",
    "SeniorPool",
  ])
  const config = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {from: await getProtocolOwner()})
  const goldfinchConfigContract = await getDeployedContract<GoldfinchConfig>(hre.deployments, "GoldfinchConfig")

  const tranchedPool = await deployTranchedPool(deployer, {config: goldfinchConfigContract})
  goldfinchConfigContract.setTranchedPoolImplementation(tranchedPool.address)

  const poolRewards = await deployPoolRewards(deployer, {configAddress: config.address, deployEffects})

  return {
    deployedContracts: {
      poolRewards,
    },
    upgradedContracts,
  }
}
