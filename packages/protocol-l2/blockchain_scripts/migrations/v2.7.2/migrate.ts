import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {deployTranchedPoolImplementationRepository} from "../../baseDeploy/deployTranchedPoolImplementationRepository"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.7.2 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/815",
  })
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  const ucuRepo = await deployTranchedPoolImplementationRepository(deployer, {config, deployEffects})

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["GoldfinchFactory"],
  })

  // Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  const deployedContracts = {ucuRepo}

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.7.2 deploy")
  return {
    upgradedContracts,
    deployedContracts,
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
