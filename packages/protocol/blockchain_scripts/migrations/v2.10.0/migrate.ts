import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {MAINNET_WARBLER_LABS_MULTISIG} from "../../mainnetForkingHelpers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.10.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/720",
    via: MAINNET_WARBLER_LABS_MULTISIG,
  })
  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade(
    {contracts: ["UniqueIdentity"]},
    {proxyOwner: MAINNET_WARBLER_LABS_MULTISIG}
  )

  // Change implementations
  deployEffects.add(await changeImplementations({contracts: upgradedContracts}, MAINNET_WARBLER_LABS_MULTISIG))

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.8.0 deploy")
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
