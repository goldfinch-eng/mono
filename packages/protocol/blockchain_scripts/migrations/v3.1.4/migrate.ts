import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  console.log("Starting v3.1.3 deploy")

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const deployEffects = await getDeployEffects({
    title: "v3.1.4 upgrade",
    description: "TODO",
  })

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards"],
  })
  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  console.log("Going to execute deferred deploy effects...")
  await deployEffects.executeDeferred()
  console.log("Finished v3.1.4 deploy")
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
