import hre from "hardhat"
import {Go, GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {ContractDeployer, ContractUpgrader, getEthersContract, ZERO_ADDRESS} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {getOldConfig} from "../v2.2/deploy"

/**
 * Fix a deployment issue on rinkeby. The issue was caused by the following:
 *  - We deployed v2.2
 *  - We then realized that UniqueIdentity and Go hadn't yet been deployed on rinkeby. We deployed v2.1.
 *  - The v2.1 deployment uses the current config for Go's initializer. Thus Go was (incorrectly) initialized with the new proxied GoldfinchConfig
 *  - We deployed v2.3, which uses Go.config() to set as the legacyGoList, which was incorrectly set to the new proxied GoldfinchConfig. It also called
 *    Go.updateGoldfinchConfig() to update Go.config() to the new proxied GoldfinchConfig address. However, since Go.config() already pointed to the
 *    new proxied GoldfinchConfig, which does not have the GoldfinchConfigAddress key set, Go.config() was incorrectly set to the zero address.
 */
async function tempUpgradeFix() {
  const effects = await getDeployEffects({title: "Temp upgrade fix"})

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })
  const go = await getEthersContract<Go>("Go")
  effects.add(await changeImplementations({contracts: upgradedContracts}))
  effects.add({
    deferred: [
      await go.populateTransaction.tempRinkebyFixPerformUpgrade(),
      await go.populateTransaction.setLegacyGoList(await getOldConfig()),
    ],
  })

  await effects.executeDeferred()
}

async function tempDowngradeFix() {
  const effects = await getDeployEffects()

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })
  await effects.executeDeferred()
}

if (require.main === module) {
  tempDowngradeFix()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
