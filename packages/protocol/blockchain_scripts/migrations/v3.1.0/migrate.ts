import hre, {ethers} from "hardhat"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  populateTxAndLog,
} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {CreditLine, GoldfinchConfig, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {MAINNET_WARBLER_LABS_MULTISIG} from "../../mainnetForkingHelpers"
import {PopulatedTransaction} from "ethers/lib/ethers"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocolOwner = await getProtocolOwner()

  const provider = ethers.getDefaultProvider()
  const gasPrice = await provider.getGasPrice()
  const gasPriceToUse = gasPrice.mul("12").div("10")
  if (!gf_deployer) {
    throw new Error("gf_deployer not found")
  }

  const deployEffects = await getDeployEffects({
    title: "v3.1.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/720",
    via: MAINNET_WARBLER_LABS_MULTISIG,
  })

  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const tranchedPool = await deployer.deploy<TranchedPool>("TranchedPool", {
    from: gf_deployer,
    gasLimit: 2000000,
    gasPrice: gasPriceToUse,
  })

  const creditLine = await deployer.deploy<CreditLine>("CreditLine", {
    from: gf_deployer,
    gasLimit: 2000000,
    gasPrice: gasPriceToUse,
  })

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({contracts: ["UniqueIdentity", "SeniorPool", "Go"]})

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const deferredDeployEffects: PopulatedTransaction[] = [
    await populateTxAndLog(
      goldfinchConfig.populateTransaction.setCreditLineImplementation(creditLine.address),
      `Populated tx to set the Credit Line implementation to ${creditLine.address}`
    ),
    await populateTxAndLog(
      goldfinchConfig.populateTransaction.setTranchedPoolImplementation(tranchedPool.address),
      `Populated tx to set the Tranched Pool implementation to ${tranchedPool.address}`
    ),
  ]

  // Execute effects
  deployEffects.add({deferred: deferredDeployEffects})
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
