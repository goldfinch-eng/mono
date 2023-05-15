import {
  ContractDeployer,
  ETHDecimals,
  getEthersContract,
  getProtocolOwner,
  getTempMultisig,
  getTruffleContract,
  isMainnetForking,
  LOCAL_CHAIN_ID,
  MAINNET_CHAIN_ID,
  MINTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
} from "../../deployHelpers"
import hre, {deployments, getChainId} from "hardhat"
import {DeployEffects, Effects} from "../deployEffects"
import {asNonNullable} from "@goldfinch-eng/utils"
import {
  CommunityRewards,
  GFI,
  GoldfinchConfig,
  MerkleDirectDistributor,
  TranchedPool,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {GFIInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "../../configKeys"
import poolMetadata from "@goldfinch-eng/pools/metadata/mainnet.json"
import {Contract} from "ethers"
import {deployCommunityRewards} from "../../baseDeploy/deployCommunityRewards"
import {deployConfigProxy} from "../../baseDeploy/deployConfigProxy"
import {deployLPStakingRewards} from "../../baseDeploy/deployLPStakingRewards"
import {deployMerkleDirectDistributor} from "../../baseDeploy/deployMerkleDirectDistributor"
import {deployMerkleDistributor} from "../../baseDeploy/deployMerkleDistributor"
import BN from "bn.js"
import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  gfiTotalSupply,
  NO_VESTING_MERKLE_INFO_PATH,
  VESTING_MERKLE_INFO_PATH,
} from "../../../blockchain_scripts/airdrop/community/calculation"
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
    contracts.map((c) => (typeof c === "string" ? getEthersContract(c as any, {from: protocolOwner}) : c))
  )
  const updates = await Promise.all(
    ethersContracts.map((c) => asNonNullable(c.populateTransaction.updateGoldfinchConfig)())
  )

  return {
    deferred: [await existingConfig.populateTransaction.setGoldfinchConfig(newConfig.address), ...updates],
  }
}

export async function getOldConfig() {
  const chainId = await getChainId()
  if (isMainnetForking()) {
    return "0x4eb844Ff521B4A964011ac8ecd42d500725C95CC"
  } else if (chainId === LOCAL_CHAIN_ID) {
    throw new Error("Not supported")
  } else if (chainId === MAINNET_CHAIN_ID) {
    return "0x4eb844Ff521B4A964011ac8ecd42d500725C95CC"
  } else {
    throw new Error(`Unknown old GoldfinchConfig for chain id ${chainId}`)
  }
}

export async function deploy(deployEffects: DeployEffects, anonDeployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const protocolOwner = await getProtocolOwner()

  console.log("Starting deployment")

  // 1.
  // Deploy a proxied GoldfinchConfig so we don't need to keep calling updateGoldfinchConfig
  // on an increasing number of contracts
  const existingConfigAddress = await getOldConfig()
  const existingConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: existingConfigAddress,
    from: protocolOwner,
  })
  console.log("Deploying config proxy")
  const config = (await deployConfigProxy(deployer, {deployEffects})).connect(protocolOwner)
  await deployEffects.add({
    deferred: [
      await config.populateTransaction.initializeFromOtherConfig(
        existingConfigAddress,
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
  console.log("Deploying liquidity mining + airdrop contracts")
  const gfiContract = await getTruffleContract<GFIInstance>("GFI")
  const gfi = {name: "GFI", contract: gfiContract}

  const lpStakingRewards = await deployLPStakingRewards(deployer, {config, deployEffects})
  const communityRewards = await deployCommunityRewards(deployer, {config, deployEffects})

  const merkleDistributor = await deployMerkleDistributor(deployer, {
    communityRewards,
    deployEffects,
    merkleDistributorInfoPath: VESTING_MERKLE_INFO_PATH,
  })
  const merkleDirectDistributor = await deployMerkleDirectDistributor(deployer, {
    gfi,
    deployEffects,
    merkleDirectDistributorInfoPath: NO_VESTING_MERKLE_INFO_PATH,
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

  const goldfinchCoinbaseCustodyAddress = "0xc95c99CeF8A8D0DbFEd996021d11c1635674B1be"

  // Some GFI has already been minted, so we need to account for it
  const existingSupply = await gfi.contract.totalSupply()

  const gfiAllocationsByAddress = {
    [goldfinchCoinbaseCustodyAddress]: "56250630099154500000000000",
    [communityRewards.contract.address]: "14745027289195700000000000",
    [asNonNullable(merkleDirectDistributor).contract.address]: "4500813523096940000000000",
    [protocolOwner]: new BigNumber("29646386049938100000000000").minus(existingSupply.toString()).toFixed(0),
    [lpStakingRewards.address]: "9142857120000000000000000",
  }

  const expectedAllocation = new BigNumber(gfiTotalSupply.sub(existingSupply).toString())

  const totalAllocationBeforeCorrection = Object.values(gfiAllocationsByAddress).reduce(
    (acc, x) => acc.plus(x),
    new BigNumber(0)
  )

  // 0.1 GFI tolerance
  const overallocationTolerance = new BigNumber(1e17)
  const difference = totalAllocationBeforeCorrection.minus(expectedAllocation)

  console.log(`subtracting ${difference.toString()} from treasury to account for overallocation`)

  if (difference.gt(overallocationTolerance)) {
    throw new Error(
      `Unacceptable difference found in minting amounts found: difference = ${difference.toString()} - tolerance = ${overallocationTolerance.toString()}`
    )
  }

  if (difference.lt(new BigNumber("0"))) {
    throw new Error(`Underallocating by ${difference.toString()}!`)
  }

  // subtract any overallocation from the goldfinch treasury. Note this is
  // required to be an extremely small amount (<0.1 GFI) to rectify any small
  // overallocations
  gfiAllocationsByAddress[protocolOwner] = new BigNumber(gfiAllocationsByAddress[protocolOwner] as string)
    .minus(difference)
    .toFixed(0)

  console.log("Created transactions for minting GFI")
  for (const [address, amount] of Object.entries(gfiAllocationsByAddress)) {
    console.log(` minting ${amount} GFI to ${address}`)
  }

  const totalAllocation = Object.values(gfiAllocationsByAddress).reduce(
    (acc, x) => acc.plus(new BigNumber(x)),
    new BigNumber(0)
  )

  if (!totalAllocation.eq(expectedAllocation)) {
    throw new Error(
      `Not allocating all GFI: expected ${expectedAllocation.toString()} - found ${totalAllocation.toString()}`
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
  // Pause deployed contracts
  // CommunityRewards, MerkleDirectDistributor, StakingRewards
  const merkleDirectDistributorEthersContract = await getEthersContract<MerkleDirectDistributor>(
    "MerkleDirectDistributor",
    {
      at: merkleDirectDistributor?.contract.address,
    }
  )

  process.stdout.write(
    "Creating transactions to pause CommunityRewards, MerkleDirectDistributor, and StakingRewards...."
  )
  await deployEffects.add({
    deferred: [
      await communityRewardsEthersContract.populateTransaction.pause(),
      await merkleDirectDistributorEthersContract.populateTransaction.pause(),
      await lpStakingRewards.populateTransaction.pause(),
    ],
  })
  console.log("done.")

  return {
    deployedContracts: {
      config,
      lpStakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
    },
    upgradedContracts: {},
  }
}
