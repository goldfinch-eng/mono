import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.8.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/694",
  })

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Zapper", "StakingRewards"],
  })

  // Change implementations
  deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const deployedContracts = {}

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.8.0 deploy")

  return {
    upgradedContracts,
    deployedContracts,
  }
}
