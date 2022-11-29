import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.7.4 upgrade",
    description: "Accountant writedown bug fix",
  })

  // Upgrading the senior pool will link its impl to the patched Accountant library
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["SeniorPool"],
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.executeDeferred()
  return {}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
