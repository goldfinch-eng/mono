import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner} from "../../deployHelpers"
import hre from "hardhat"
import {changeImplementations, DeployEffects, getDeployEffects} from "../deployEffects"
import {GoldfinchConfig, UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {deployments} from "hardhat"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const protocolOwner = await getProtocolOwner()

  const effects = await getDeployEffects({
    title: "v2.5",
    description: "Upgrade Go contract's goSeniorPool and update UniqueIdentity supportedUIDTypes",
  })

  const existingConfigDeployment = await deployments.get("GoldfinchConfig")
  const existingConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: existingConfigDeployment.address,
    from: protocolOwner,
  })

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  // 2.
  // Deploy TranchedPool & set TranchedPoolImplementation
  const tranchedPool = await deployTranchedPool(deployer, {config: existingConfig, deployEffects})

  // 3.
  // Add support for US Entity and Non US Entity types to UID
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity", {
    at: (await deployments.get("UniqueIdentity")).address,
  })
  await effects.add({
    deferred: [
      await uniqueIdentity.populateTransaction.setSupportedUIDTypes([0, 1, 2, 3, 4], [true, true, true, true, true]),
    ],
  })

  await effects.executeDeferred()

  return {
    deployedContracts: {
      tranchedPool,
    },
    upgradedContracts,
  }
}
