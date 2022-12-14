import hre from "hardhat"
import {ContractDeployer, ContractUpgrader} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {MAINNET_WARBLER_LABS_MULTISIG} from "../../mainnetForkingHelpers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v3.1.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/720",
    via: MAINNET_WARBLER_LABS_MULTISIG,
    safeConfig: {safeAddress: MAINNET_WARBLER_LABS_MULTISIG, executor: "0x67c5733ca0101eed21728902ef0ace4ced1cc52a"},
  })

  const upgrader = new ContractUpgrader(deployer)

  // Upgrade UniqueIdentity - owned by MAINNET_WARBLER_LABS_MULTISIG
  const upgradeUniqueIdentity = await upgrader.upgrade(
    {contracts: ["UniqueIdentity"]},
    {proxyOwner: MAINNET_WARBLER_LABS_MULTISIG}
  )

  await deployEffects.add(await changeImplementations({contracts: upgradeUniqueIdentity}))

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v3.1.0 deploy")
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
