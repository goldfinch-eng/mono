import hre from "hardhat"

import {changeImplementations, getDeployEffects} from "./deployEffects"
import {ContractDeployer, ContractUpgrader, getProtocolOwner} from "../deployHelpers"

export async function main() {
  console.log("Starting deploy 1.1.0")
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v1.1.0 Upgrade GoldfinchPrime to allow depositWithPermit",
    description: "Upgrade GoldfinchPrime to allow setting depositWithPermit",
    via: await getProtocolOwner(),
  })

  const upgrader = new ContractUpgrader(deployer)
  const upgradedContracts = await upgrader.upgrade({contracts: ["GoldfinchPrime"]})

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))
  await deployEffects.executeDeferred()

  console.log("Finished deploy 1.1.0")
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
