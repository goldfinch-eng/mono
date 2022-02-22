import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import hre from "hardhat"
import {changeImplementations, DeployEffects} from "../deployEffects"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  return {
    deployedContracts: {},
    upgradedContracts,
  }
}
