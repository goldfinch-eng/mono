import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import hre from "hardhat"
import {changeImplementations, DeployEffects} from "../deployEffects"
import {Go} from "@goldfinch-eng/protocol/typechain/ethers"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })

  // 2.
  // Upgrade Go contract
  const go = await getEthersContract<Go>("Go", {at: upgradedContracts.Go?.ProxyContract.address})
  const goConfigAddress = await go.config()

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.add({
    deferred: [
      await go.populateTransaction.setLegacyGoList(goConfigAddress),
      await go.populateTransaction.updateGoldfinchConfig(),
      await go.populateTransaction.performUpgrade(),
    ],
  })

  return {
    deployedContracts: {},
    upgradedContracts,
  }
}
