import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const effects = await getDeployEffects({
    title: "v2.3.3 hotfix",
    description: "https://github.com/warbler-labs/mono/pull/246",
  })

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["CommunityRewards"],
  })

  await effects.add(await changeImplementations({contracts: upgradedContracts}))

  await effects.executeDeferred()
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
