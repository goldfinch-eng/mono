import {
  ContractDeployer,
  ContractUpgrader,
  ETHDecimals,
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {DeployEffects, Effects} from "../deployEffects"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {GoldfinchConfig, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {GFIInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "../../configKeys"
import poolMetadata from "@goldfinch-eng/client/config/pool-metadata/mainnet.json"
import {Contract} from "ethers"
import {generateMerkleRoot as generateMerkleDirectRoot} from "../../merkle/merkleDirectDistributor/generateMerkleRoot"
import {generateMerkleRoot} from "../../merkle/merkleDistributor/generateMerkleRoot"
import {promises as fs} from "fs"
import path from "path"
import {deployCommunityRewards} from "../../baseDeploy/deployCommunityRewards"
import {deployConfigProxy} from "../../baseDeploy/deployConfigProxy"
import {deployDynamicLeverageRatioStrategy} from "../../baseDeploy/deployDynamicLeverageRatioStrategy"
import {deployLPStakingRewards} from "../../baseDeploy/deployLPStakingRewards"
import {deployMerkleDirectDistributor} from "../../baseDeploy/deployMerkleDirectDistributor"
import {deployMerkleDistributor} from "../../baseDeploy/deployMerkleDistributor"
import BN from "bn.js"
import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"

// https://docs.google.com/spreadsheets/d/1GL42WwB4EUFvzVXv05R3kNp8YpCZG_zoHXHZg55nfdo/edit?usp=sharing
export const STAKING_REWARDS_PARAMS = {
  targetCapacity: bigVal(100_000_000),
  minRate: new BN("0"),
  /*
    let gfiMantissa     = 10**18
        secondsPerYear  = 365 * 24 * 60 * 60 = 31536000
        totalGfi        = 114_285_715
    in
      maxRate = totalGfi
        * gfiMantissa
        / 200  // (equivalent of taking 0.5%)
        * 12   // number of months so that we're taking ~0.5% per month
        / secondsPerYear
        / gfiMantissa
  */
  // 0.217438574961948000 rewards per second
  maxRate: new BN("217438574961948000"),
  // 200%
  minRateAtPercent: new BN(2).mul(ETHDecimals),
  // 50%
  maxRateAtPercent: ETHDecimals.div(new BN(2)),
}

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
  // TODO: Mint GFI, distribute to contracts / EOAs, set reward parameters
  // 3.1 set goldfinch config address for GFI
  await deployEffects.add({
    deferred: [await config.populateTransaction.setAddress(CONFIG_KEYS.GFI, gfi.contract.address)],
  })

  // 3.x (TODO: number this after gfi config set)
  console.log(`creating transaction for setting staking rewards params`)
  console.log(` targetCapacity   = ${STAKING_REWARDS_PARAMS.targetCapacity}`)
  console.log(` minRate          = ${STAKING_REWARDS_PARAMS.minRate}`)
  console.log(` maxRate          = ${STAKING_REWARDS_PARAMS.maxRate}`)
  console.log(` minRateAtPercent = ${STAKING_REWARDS_PARAMS.minRateAtPercent}`)
  console.log(` maxRateAtPercent = ${STAKING_REWARDS_PARAMS.maxRateAtPercent}`)

  deployEffects.add({
    deferred: [
      await lpStakingRewards.populateTransaction.setRewardsParameters(
        STAKING_REWARDS_PARAMS.targetCapacity.toString(),
        STAKING_REWARDS_PARAMS.minRate.toString(),
        STAKING_REWARDS_PARAMS.maxRate.toString(),
        STAKING_REWARDS_PARAMS.minRateAtPercent.toString(),
        STAKING_REWARDS_PARAMS.maxRateAtPercent.toString()
      ),
    ],
  })

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
