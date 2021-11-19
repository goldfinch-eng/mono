import {deployBackerRewards, deployTranchedPool} from "../../baseDeploy"
import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {DeployEffects} from "../deployEffects"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const protocolOwner = await getProtocolOwner()

  const existingConfigDeployment = await deployments.get("GoldfinchConfig")
  const existingConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: existingConfigDeployment.address,
    from: protocolOwner,
  })

  // await existingConfig.populateTransaction.setAddress(CONFIG_KEYS.Go, contract.address)
  // await existingConfig.setTranchedPoolImplementation(tranchedPool.address)

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({contracts: ["PoolTokens", "SeniorPool", "Go", "UniqueIdentity"]})

  // 2.
  // Deploy TranchedPool & set TranchedPoolImplementation
  const tranchedPool = await deployTranchedPool(deployer, {config: existingConfig, deployEffects})

  // 3.
  // Deploy BackerRewards
  const backerRewards = await deployBackerRewards(deployer, {configAddress: existingConfig.address, deployEffects})

  return {
    deployedContracts: {
      backerRewards,
      tranchedPool,
    },
    upgradedContracts,
  }
}
