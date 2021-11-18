import {
  deployUniqueIdentity,
  deployGo,
  deployLPStakingRewards,
  deployCommunityRewards,
  deployMerkleDistributor,
  deployConfigProxy,
  deployMerkleDirectDistributor,
  deployDynamicLeverageRatioStrategy,
} from "../../baseDeploy"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  isMainnet,
} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {DeployEffects, Effects} from "../deployEffects"
import {asNonNullable} from "@goldfinch-eng/utils"
import {Contract} from "ethers"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {GFIInstance} from "@goldfinch-eng/protocol/typechain/truffle"

async function updateGoldfinchConfigs({
  existingConfig,
  newConfig,
  contractNames,
}: {
  existingConfig: GoldfinchConfig
  newConfig: GoldfinchConfig
  contractNames: string[]
}): Promise<Effects> {
  const protocolOwner = await getProtocolOwner()
  const contracts = await Promise.all(contractNames.map((c) => getEthersContract(c, {from: protocolOwner})))
  const updates = await Promise.all(contracts.map((c) => asNonNullable(c.populateTransaction.updateGoldfinchConfig)()))

  return {
    deferred: [await existingConfig.populateTransaction.setGoldfinchConfig(newConfig.address), ...updates],
  }
}

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const protocolOwner = await getProtocolOwner()

  // 1.
  // Deploy a proxied GoldfinchConfig so we don't need to keep calling updateGoldfinchConfig
  // on an increasing number of contracts
  const existingConfigDeployment = await deployments.get("GoldfinchConfig")
  const existingConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: existingConfigDeployment.address,
    from: protocolOwner,
  })
  const config = (await deployConfigProxy(deployer, {deployEffects})).connect(protocolOwner)
  await deployEffects.add({
    deferred: [await config.populateTransaction.initializeFromOtherConfig(existingConfigDeployment.address, 10, 20)],
  })
  const updateConfigContracts = [
    "Fidu",
    "FixedLeverageRatioStrategy",
    "GoldfinchFactory",
    "SeniorPool",
    "PoolTokens",
    // TODO: Should we update individiual TranchedPools and CreditLines?
  ]
  await deployEffects.add(
    await updateGoldfinchConfigs({
      existingConfig,
      newConfig: config,
      contractNames: updateConfigContracts,
    })
  )

  // 2.
  // Deploy liquidity mining + airdrop contracts
  const gfiContract = await getTruffleContract<GFIInstance>("GFI")
  const gfi = {name: "GFI", contract: gfiContract}

  const lpStakingRewards = await deployLPStakingRewards(deployer, {config, deployEffects})
  const communityRewards = await deployCommunityRewards(deployer, {config, deployEffects})
  const merkleDistributor = await deployMerkleDistributor(deployer, {communityRewards, deployEffects})
  const merkleDirectDistributor = await deployMerkleDirectDistributor(deployer, {gfi, deployEffects})

  // 3.
  // TODO: Mint GFI, distribute to contracts / EOAs, set reward parameters

  // 4.
  // Deploy DynamicLeverageRatioStrategy (unused for now)
  const dynamicLeverageRatioStrategy = await deployDynamicLeverageRatioStrategy(deployer)

  return {
    deployedContracts: {
      lpStakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      dynamicLeverageRatioStrategy,
    },
    upgradedContracts: {},
  }
}
