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
  const upgradedContracts = await upgrader.upgrade({contracts: ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go"]})

  // 2.
  // Deploy TranchedPool & set TranchedPoolImplementation
  const tranchedPool = await deployTranchedPool(deployer, {config: existingConfig, deployEffects})

  // 3.
  // Deploy BackerRewards
  const backerRewards = await deployBackerRewards(deployer, {configAddress: existingConfig.address, deployEffects})

  // 4.
  // Upgrade Go contract
  const oldGo = await getEthersContract("Go", {
    at: upgradedContracts.Go?.ExistingContract.address,
    from: protocolOwner,
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const upgradedGo = await getEthersContract<Go>("Go", {
    at: upgradedContracts.Go?.ProxyContract.address,
    from: protocolOwner,
  })
  await deployEffects.add({
    deferred: [await upgradedGo.populateTransaction.setGoListOverride(await oldGo.config())],
  })

  // 5. update goldfinch config with new go contract
  // await existingConfig.populateTransaction.setAddress(CONFIG_KEYS.Go, contract.address)

  return {
    deployedContracts: {
      backerRewards,
      tranchedPool,
    },
    upgradedContracts,
  }
}
