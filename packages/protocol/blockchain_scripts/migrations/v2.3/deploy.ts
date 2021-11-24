import {deployBackerRewards, deployTranchedPool} from "../../baseDeploy"
import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {changeImplementations, DeployEffects} from "../deployEffects"
import {Go, GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"

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
  const tranchedPool = await deployTranchedPool(deployer, {config: existingConfig, deployEffects})

  // 3.
  // Deploy BackerRewards
  const backerRewards = await deployBackerRewards(deployer, {configAddress: existingConfig.address, deployEffects})

  // 4.
  // Upgrade Go contract
  const go = await getEthersContract<Go>("Go", {at: upgradedContracts.Go?.ProxyContract.address})
  const goConfigAddress = await go.config()

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.add({
    deferred: [
      await go.populateTransaction.setGoListOverride(goConfigAddress),
      await go.populateTransaction.updateGoldfinchConfig(),
    ],
  })

  return {
    deployedContracts: {
      backerRewards,
      tranchedPool,
    },
    upgradedContracts,
  }
}
