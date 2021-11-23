import {
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
} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {DeployEffects, Effects} from "../deployEffects"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {CreditLine, GoldfinchConfig, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {GFIInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS_BY_TYPE} from "../../configKeys"
import poolMetadata from "@goldfinch-eng/client/config/pool-metadata/mainnet.json"
import {Contract} from "ethers"
import {generateMerkleRoot as generateMerkleDirectRoot} from "../../merkle/merkleDirectDistributor/generateMerkleRoot"
import {generateMerkleRoot} from "../../merkle/merkleDistributor/generateMerkleRoot"
import {promises as fs} from "fs"
import path from "path"

async function updateGoldfinchConfigs({
  existingConfig,
  newConfig,
  contracts,
}: {
  existingConfig: GoldfinchConfig
  newConfig: GoldfinchConfig
  contracts: Array<string | Contract>
}): Promise<Effects> {
  const protocolOwner = await getProtocolOwner()
  const ethersContracts = await Promise.all(
    contracts.map((c) => (typeof c === "string" ? getEthersContract(c, {from: protocolOwner}) : c))
  )
  const updates = await Promise.all(
    ethersContracts.map((c) => asNonNullable(c.populateTransaction.updateGoldfinchConfig)())
  )

  return {
    deferred: [await existingConfig.populateTransaction.setGoldfinchConfig(newConfig.address), ...updates],
  }
}

export async function deploy(
  deployEffects: DeployEffects,
  {
    noVestingGrants,
    vestingGrants,
  }: {
    noVestingGrants: string
    vestingGrants: string
  }
) {
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
    deferred: [
      await config.populateTransaction.initializeFromOtherConfig(
        existingConfigDeployment.address,
        Object.keys(CONFIG_KEYS_BY_TYPE.numbers).length,
        Object.keys(CONFIG_KEYS_BY_TYPE.addresses).length
      ),
    ],
  })

  const tranchedPoolAddresses = Object.keys(poolMetadata)
  const tranchedPoolContracts = await Promise.all(
    tranchedPoolAddresses.map(async (address) => getEthersContract<TranchedPool>("TranchedPool", {at: address}))
  )
  const updateConfigContracts = [
    "Fidu",
    "FixedLeverageRatioStrategy",
    "GoldfinchFactory",
    "SeniorPool",
    "PoolTokens",
    ...tranchedPoolContracts,
  ]
  await deployEffects.add(
    await updateGoldfinchConfigs({
      existingConfig,
      newConfig: config,
      contracts: updateConfigContracts,
    })
  )

  // 2.
  // Deploy liquidity mining + airdrop contracts
  const gfiContract = await getTruffleContract<GFIInstance>("GFI")
  const gfi = {name: "GFI", contract: gfiContract}

  const lpStakingRewards = await deployLPStakingRewards(deployer, {config, deployEffects})
  const communityRewards = await deployCommunityRewards(deployer, {config, deployEffects})

  const vestingMerkleInfo = generateMerkleRoot(JSON.parse(await fs.readFile(vestingGrants, {encoding: "utf8"})))
  await fs.writeFile(path.join(__dirname, "./vestingMerkleInfo.json"), JSON.stringify(vestingMerkleInfo, null, 2))
  const noVestingMerkleInfo = generateMerkleDirectRoot(
    JSON.parse(await fs.readFile(noVestingGrants, {encoding: "utf8"}))
  )
  await fs.writeFile(path.join(__dirname, "./noVestingMerkleInfo.json"), JSON.stringify(noVestingMerkleInfo, null, 2))
  const merkleDistributor = await deployMerkleDistributor(deployer, {
    communityRewards,
    deployEffects,
    merkleDistributorInfoPath: path.join(__dirname, "./vestingMerkleInfo.json"),
  })
  const merkleDirectDistributor = await deployMerkleDirectDistributor(deployer, {
    gfi,
    deployEffects,
    merkleDirectDistributorInfoPath: path.join(__dirname, "./noVestingMerkleInfo.json"),
  })

  // 3.
  // TODO: Mint GFI, distribute to contracts / EOAs, set reward parameters, set GFI in config

  // 4.
  // Deploy DynamicLeverageRatioStrategy (unused for now)
  const dynamicLeverageRatioStrategy = await deployDynamicLeverageRatioStrategy(deployer)

  return {
    deployedContracts: {
      config,
      lpStakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      dynamicLeverageRatioStrategy,
    },
    upgradedContracts: {},
  }
}
