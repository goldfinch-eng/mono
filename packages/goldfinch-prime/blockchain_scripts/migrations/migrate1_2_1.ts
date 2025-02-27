import hre from "hardhat"

import {changeImplementations, getDeployEffects} from "./deployEffects"
import {ContractDeployer, ContractUpgrader, getProtocolOwner} from "../deployHelpers"

export async function main() {
  console.log("Starting deploy 1.2.0")
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v1.2.1 Reduce UniqueIdentity fixed fee",
    description: "Since we're on L2, this fee does not need to be as high",
    via: await getProtocolOwner(),
  })

  const upgrader = new ContractUpgrader(deployer)
  const upgradedContracts = await upgrader.upgrade({contracts: ["UniqueIdentity"]})

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))
  await deployEffects.executeDeferred()

  console.log("Finished deploy 1.2.1")
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
