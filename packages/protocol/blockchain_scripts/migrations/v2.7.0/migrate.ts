import {PoolTokens} from "@goldfinch-eng/protocol/typechain/ethers"
import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const deployEffects = await getDeployEffects({
    title: "v2.7.0 upgrade",
    description: "TODO",
  })

  // 1. Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["PoolTokens"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // Set metadata base URI for PoolTokens
  const poolTokens = await getEthersContract<PoolTokens>("PoolTokens")
  deployEffects.add({
    deferred: [
      await poolTokens.populateTransaction.setBaseURI(
        "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/poolTokenMetadata/"
      ),
    ],
  })

  const deployedContracts = {}

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.7.0 deploy")
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
