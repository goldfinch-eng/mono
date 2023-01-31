import hre, {ethers} from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract, populateTxAndLog} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {PopulatedTransaction} from "ethers/lib/ethers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v3.1.1 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/720",
  })

  const {gf_deployer} = await deployer.getNamedAccounts()

  const upgrader = new ContractUpgrader(deployer)

  const provider = ethers.getDefaultProvider()
  const gasPrice = await provider.getGasPrice()
  const gasPriceToUse = gasPrice.mul("12").div("10")
  if (!gf_deployer) {
    throw new Error("gf_deployer not found")
  }

  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  const accountant = await deployer.deployLibrary("Accountant", {
    from: gf_deployer,
  })

  const creditLine = await deployer.deploy("CreditLine", {
    from: gf_deployer,
    gasPrice: gasPriceToUse,
    libraries: {
      Accountant: accountant.address,
    },
  })

  // Upgrade Go - owned by Protocol Owner/Governance multisig
  const upgradeGoldfinchGovernanceOwnedContracts = await upgrader.upgrade({contracts: ["Go"]})

  await deployEffects.add(await changeImplementations({contracts: upgradeGoldfinchGovernanceOwnedContracts}))

  const deferredDeployEffects: PopulatedTransaction[] = [
    await populateTxAndLog(
      goldfinchConfig.populateTransaction.setCreditLineImplementation(creditLine.address),
      `Populated tx to set the Credit Line implementation to ${creditLine.address}`
    ),
  ]

  // Execute effects
  deployEffects.add({deferred: deferredDeployEffects})
  await deployEffects.executeDeferred()
  console.log("Finished v3.1.1 deploy")
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
