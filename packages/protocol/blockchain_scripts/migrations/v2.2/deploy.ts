import {
  ContractDeployer,
  ContractUpgrader,
  ETHDecimals,
  getEthersContract,
  getProtocolOwner,
  getTempMultisig,
  getTruffleContract,
  isMainnet,
  MINTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
} from "../../deployHelpers"
import hre, {deployments} from "hardhat"
import {DeployEffects, Effects} from "../deployEffects"
import {asNonNullable} from "@goldfinch-eng/utils"
import {CommunityRewards, GFI, GoldfinchConfig, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
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
import {gfiTotalSupply} from "../../../blockchain_scripts/airdrop/community/calculation"
import BigNumber from "bignumber.js"

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
  anonDeployEffects: DeployEffects,
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

  // 3. Deploy GFI and set staking rewards parameters
  const gfiEthersContract = await getEthersContract<GFI>("GFI")
  // 3.1 set goldfinch config address for GFI
  await deployEffects.add({
    deferred: [await config.populateTransaction.setAddress(CONFIG_KEYS.GFI, gfi.contract.address)],
  })

  // 3.2 Set staking rewards parameters
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

  const tempMultisig = await getTempMultisig()

  console.log(`Using address "${tempMultisig}" as current GFI owner`)
  console.log("Beginning transfer of GFI to Goldfinch Governance")
  console.log(" creating transactions to grant permissions to the multisig")
  // 3.3 transfer ownership from anon to multisig
  await anonDeployEffects.add({
    deferred: [
      await gfiEthersContract.populateTransaction.grantRole(OWNER_ROLE, await getProtocolOwner()),
      await gfiEthersContract.populateTransaction.grantRole(MINTER_ROLE, await getProtocolOwner()),
      await gfiEthersContract.populateTransaction.grantRole(PAUSER_ROLE, await getProtocolOwner()),
    ],
  })

  // 3.4 revoke ownership from anon
  console.log(" creating transactions to revoke permissions from the temp multisig")
  await deployEffects.add({
    deferred: [
      await gfiEthersContract.populateTransaction.revokeRole(OWNER_ROLE, tempMultisig),
      await gfiEthersContract.populateTransaction.revokeRole(MINTER_ROLE, tempMultisig),
      await gfiEthersContract.populateTransaction.revokeRole(PAUSER_ROLE, tempMultisig),
    ],
  })

  // 3.5 increase cap of GFI
  await deployEffects.add({
    deferred: [await gfiEthersContract.populateTransaction.setCap(gfiTotalSupply.toString())],
  })

  if (await isMainnet()) {
    throw new Error("This script should not be run on mainnet!")
  }
  const goldfinchCoinbaseCustodyAddress = "0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2" // TODO(will): find actual address

  const getPercentOfGfi = (percent) => {
    return new BigNumber(gfiTotalSupply.toString()).multipliedBy(percent).toPrecision()
  }

  // Some GFI has already been minted, so we need to account for it
  const existingSupply = await gfi.contract.totalSupply()

  const gfiAllocationsByAddress = {
    [goldfinchCoinbaseCustodyAddress]: new BN(getPercentOfGfi("0.4704"))
      // v- this portion is unallocated
      .add(new BN("4125714275400000000000000"))
      .sub(existingSupply)
      .toString(),
    [communityRewards.contract.address]: getPercentOfGfi("0.1118").toString(),
    [asNonNullable(merkleDirectDistributor).contract.address]: getPercentOfGfi("0.0373").toString(),
    [protocolOwner]: getPercentOfGfi("0.2444").toString(),
    [lpStakingRewards.address]: getPercentOfGfi("0.1").toString(), // 10%
  }

  console.log("Created transactions for minting GFI")
  for (const [address, amount] of Object.entries(gfiAllocationsByAddress)) {
    console.log(` minting ${amount} GFI to ${address}`)
  }

  const totalAllocation = Object.values(gfiAllocationsByAddress).reduce((acc, x) => acc.add(new BN(x)), new BN(0))
  const expectedAllocation = gfiTotalSupply.sub(existingSupply)
  if (!totalAllocation.eq(expectedAllocation)) {
    throw new Error(
      `All of GFI has not been allocated! expected ${expectedAllocation.toString()} ; found ${totalAllocation.toString()}`
    )
  }

  console.log(`Amount of GFI allocated: ${totalAllocation}`)

  const communityRewardsEthersContract = await getEthersContract<CommunityRewards>("CommunityRewards", {
    at: (await deployments.get("CommunityRewards")).address,
  })

  console.log(`creating transaction to set GFI cap to ${gfiTotalSupply.toString()}`)
  await deployEffects.add({
    deferred: [await gfiEthersContract.populateTransaction.setCap(gfiTotalSupply.toString())],
  })

  console.log("creating transactions for minting GFI")
  await deployEffects.add({
    deferred: [
      await gfiEthersContract.populateTransaction.mint(
        goldfinchCoinbaseCustodyAddress,
        gfiAllocationsByAddress[goldfinchCoinbaseCustodyAddress] as string
      ),
      // // BEGIN LOADING COMMUNITY REWARDS
      await gfiEthersContract.populateTransaction.mint(
        protocolOwner,
        gfiAllocationsByAddress[communityRewardsEthersContract.address] as string
      ),
      await gfiEthersContract.populateTransaction.approve(
        communityRewardsEthersContract.address,
        gfiAllocationsByAddress[communityRewardsEthersContract.address] as string
      ),
      await communityRewardsEthersContract.populateTransaction.loadRewards(
        gfiAllocationsByAddress[communityRewardsEthersContract.address] as string
      ),
      // // END LOADING COMMUNITY REWARDS
      await gfiEthersContract.populateTransaction.mint(
        merkleDirectDistributor?.contract.address as string,
        gfiAllocationsByAddress[merkleDirectDistributor?.contract.address as string] as string
      ),
      await gfiEthersContract.populateTransaction.mint(protocolOwner, gfiAllocationsByAddress[protocolOwner] as string),
      // BEGIN LOADING LPSTAKING REWARDS
      await gfiEthersContract.populateTransaction.mint(
        protocolOwner,
        gfiAllocationsByAddress[lpStakingRewards.address] as string
      ),
      await gfiEthersContract.populateTransaction.approve(
        lpStakingRewards.address,
        gfiAllocationsByAddress[lpStakingRewards.address] as string
      ),
      await lpStakingRewards.populateTransaction.loadRewards(
        gfiAllocationsByAddress[lpStakingRewards.address] as string
      ),
      // END LOADING LPSTAKING REWARDS
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
