import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.7.1",
    description: "https://github.com/warbler-labs/mono/pull/815",
  })

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Zapper", "StakingRewards"],
  })

  // Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.7.1 deploy")
  return {
    upgradedContracts,
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
