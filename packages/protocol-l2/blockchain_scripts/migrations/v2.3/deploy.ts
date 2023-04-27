import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {changeImplementations, DeployEffects} from "../deployEffects"
import {Go, GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {deployBackerRewards} from "../../baseDeploy"
import {deployClImplementation} from "../../baseDeploy/deployClImplementation"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const protocolOwner = await getProtocolOwner()

  const existingConfigDeployment = await deployments.get("GoldfinchConfig")
  const existingConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: existingConfigDeployment.address,
    from: protocolOwner,
  })

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go", "GoldfinchFactory"],
  })

  // 2.
  // Deploy TranchedPool & set TranchedPoolImplementation
  const tranchedPool = await deployTranchedPool(deployer)

  // 4.
  // Deploy CreditLine & set CreditLineImplementation
  await deployClImplementation(deployer, {config: existingConfig, deployEffects})

  // 5.
  // Deploy BackerRewards
  const backerRewards = await deployBackerRewards(deployer, {configAddress: existingConfig.address, deployEffects})

  // 6.
  // Upgrade Go contract
  const go = await getEthersContract<Go>("Go", {at: upgradedContracts.Go?.ProxyContract.address})
  const goConfigAddress = await go.config()

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.add({
    deferred: [
      await go.populateTransaction.setLegacyGoList(goConfigAddress),
      // @ts-expect-error Ignore broken call to function that has been removed.
      await go.populateTransaction.updateGoldfinchConfig(),
      await go.populateTransaction.performUpgrade(),
    ],
  })

  // 7. upgrade goldfinch factory
  // const goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory", {
  //   at: upgradedContracts.GoldfinchFactory?.ProxyContract.address,
  // })
  // await deployEffects.add({
  //   deferred: [await goldfinchFactory.populateTransaction.performUpgrade()],
  // })

  return {
    deployedContracts: {
      backerRewards,
      tranchedPool,
    },
    upgradedContracts,
  }
}
