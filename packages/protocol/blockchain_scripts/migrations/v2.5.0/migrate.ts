import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {BackerRewards, GFI, UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export type Migration250Params = {
  BackerRewards: {
    totalRewards: string
    maxInterestDollarsEligible: string
  }
  UniqueIdentity: {
    supportedUidTypes: number[]
  }
}

const STRATOS_POOL_ADDR = "0x00c27fc71b159a346e179b4a1608a0865e8a7470"
const ALMA_6_POOL_ADDR = "0x418749e294cabce5a714efccc22a8aade6f9db57"
const CAURIS_2_POOL_ADDR = "0xd09a57127bc40d680be7cb061c2a6629fe71abef"

interface StakingRewardsInfoInitValues {
  accumulatedRewardsPerToken: string
  fiduSharePriceAtDrawdown: string
  principalDeployedAtDrawdown: string
}

export const BACKER_REWARDS_PARAMS_POOL_ADDRS = [STRATOS_POOL_ADDR, ALMA_6_POOL_ADDR, CAURIS_2_POOL_ADDR]

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  // const BACKER_REWARDS_PARAMS_BY_POOL_ADDR: {
  //   [key: string]: StakingRewardsInfoInitValues
  // } = {
  //   // Stratos drawdown
  //   // https://etherscan.io/tx/0x44adb6f8d03b7308e93f226ccc8fb6b6e39c2083c2ff15c6e3e8160b2eb932e1
  //   // 14251940
  //   // 0x44adb6f8d03b7308e93f226ccc8fb6b6e39c2083c2ff15c6e3e8160b2eb932e1
  //   [STRATOS_POOL_ADDR]: {
  //     accumulatedRewardsPerToken: "14764838139349853151",
  //     fiduSharePriceAtDrawdown: "1049335199989661790",
  //     // Stratos drawed down over 2 transactions
  //     principalDeployedAtDrawdown: "20000000000000",
  //   },
  //   // Cauris #2 drawdown tx
  //   // https://etherscan.io/tx/0xe228d3544e2f198308dc5fe968ffe995ab2bcbb82385b7751f4859b94391432e
  //   // 14272551
  //   // 0xe228d3544e2f198308dc5fe968ffe995ab2bcbb82385b7751f4859b94391432e
  //   [CAURIS_2_POOL_ADDR]: {
  //     accumulatedRewardsPerToken: "14765542624996072988",
  //     fiduSharePriceAtDrawdown: "1049335199989661790",
  //     principalDeployedAtDrawdown: "10000000000000",
  //   },
  //   // Almavest #6 drawdown tx
  //   // https://etherscan.io/tx/0x2052a29593c467299d0863a43f48e71b7107b948627b16e6d503c3e27d8e5b32
  //   // 14250440
  //   // 0x2052a29593c467299d0863a43f48e71b7107b948627b16e6d503c3e27d8e5b32
  //   [ALMA_6_POOL_ADDR]: {
  //     accumulatedRewardsPerToken: "14764765626591738655",
  //     fiduSharePriceAtDrawdown: "1048979727966257806",
  //     principalDeployedAtDrawdown: "11812267272185",
  //   },
  // }

  const deployEffects = await getDeployEffects({
    title: "v2.5.0 upgrade",
    description: `
    Upgrades Go and CommunityRewards contracts

    https://github.com/warbler-labs/mono/pull/390
    https://github.com/warbler-labs/mono/pull/412
    `,
  })

  console.log("Beginning v2.5.0 upgrade")
  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity")

  async function getPoolTokensThatRedeemedBeforeLocking(poolAddress: string): Promise<{[key: string]: string}> {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const lockEvents = await tranchedPool.queryFilter(tranchedPool.filters.TrancheLocked(tranchedPool.address))
    const isJuniorTrancheLockEvent = (event) => event.args.trancheId.toNumber() === TRANCHES.Junior
    const juniorLockEvents = lockEvents.filter(isJuniorTrancheLockEvent)
    if (juniorLockEvents.length === 0) {
      throw new Error(`No junior tranche lock events found`)
    }

    // sort so that the latest lock even is first
    juniorLockEvents.sort((a, b) => b.blockNumber - a.blockNumber)

    const latestLockEvent = lockEvents[0]
    const lockBlockNumber = latestLockEvent?.blockNumber

    assertNonNullable(lockBlockNumber)

    const withdrawFilter = tranchedPool.filters.WithdrawalMade(undefined, 2)
    const withdrawalEventsBeforeLocking = await tranchedPool.queryFilter(withdrawFilter, undefined, lockBlockNumber)
    const withdrawEventWithdrewPrincipal = (event) => event.args.principalWithdrawn.toString() !== "0"
    const withdrawalsOfPrincipalBeforeLocked = withdrawalEventsBeforeLocking.filter(withdrawEventWithdrewPrincipal)

    const output = {}
    for (const event of withdrawalsOfPrincipalBeforeLocked) {
      // TODO(PR): account for multiple withdraws
      output[event.args.tokenId.toString()] = event.args.principalWithdrawn.toString()
    }

    return output
  }

  async function getRewardsParametersForPool(poolAddress: string): Promise<StakingRewardsInfoInitValues> {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const drawdownEvents = await tranchedPool.queryFilter(tranchedPool.filters.DrawdownMade())
    const lastDrawdownBlock = drawdownEvents[drawdownEvents.length - 1]?.blockNumber as number
    const totalDrawdown = drawdownEvents.reduce((acc, x) => acc.plus(x.args.amount.toString()), new BigNumber(0))

    return {
      principalDeployedAtDrawdown: totalDrawdown.toString(),
      fiduSharePriceAtDrawdown: (await seniorPool.sharePrice({blockTag: lastDrawdownBlock})).toString(),
      accumulatedRewardsPerToken: (
        await stakingRewards.accumulatedRewardsPerToken({blockTag: lastDrawdownBlock})
      ).toString(),
    }
  }

  const forceInitializeStakingRewardsPoolInfo: {[key: string]: StakingRewardsInfoInitValues} = {}
  const setPrincipalRedeemedBeforeLocking = {}
  for (const poolAddress of BACKER_REWARDS_PARAMS_POOL_ADDRS) {
    forceInitializeStakingRewardsPoolInfo[poolAddress] = await getRewardsParametersForPool(poolAddress)
    setPrincipalRedeemedBeforeLocking[poolAddress] = await getPoolTokensThatRedeemedBeforeLocking(poolAddress)
  }

  console.log(setPrincipalRedeemedBeforeLocking)

  // 1. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go", "CommunityRewards"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  const params: Migration250Params = {
    BackerRewards: {
      totalRewards: new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02").toFixed(),
      maxInterestDollarsEligible: bigVal(100_000_000).toString(),
      forceInitializeStakingRewardsPoolInfo,
    },
    UniqueIdentity: {
      supportedUidTypes: [0, 1, 2, 3, 4],
    },
  }

  console.log("Setting UniqueIdentity params:")
  console.log(` setSupportedUIDTypes = ${params.UniqueIdentity.supportedUidTypes}`)
  console.log("BackerRewards params")
  console.log(`  setTotalRewards = ${params.BackerRewards.totalRewards}`)
  console.log(`  maxInterestDollarsElligible = ${params.BackerRewards.maxInterestDollarsEligible}`)

  const backerRewardsInitTxs = await Promise.all(
    Object.entries(forceInitializeStakingRewardsPoolInfo).map(([address, params]) => {
      return backerRewards.populateTransaction.forceIntializeStakingRewardsPoolInfo(
        address,
        params.fiduSharePriceAtDrawdown,
        params.principalDeployedAtDrawdown,
        params.accumulatedRewardsPerToken
      )
    })
  )

  // TODO(PR): intialize reward parameters

  // 6. Add effects to deploy effects
  deployEffects.add({
    deferred: [
      // intialize backer rewards parameters
      await backerRewards.populateTransaction.setTotalRewards(params.BackerRewards.totalRewards),
      await backerRewards.populateTransaction.setMaxInterestDollarsEligible(
        params.BackerRewards.maxInterestDollarsEligible
      ),

      // update supported UID types
      await uniqueIdentity.populateTransaction.setSupportedUIDTypes(params.UniqueIdentity.supportedUidTypes, [
        true,
        true,
        true,
        true,
        true,
      ]),

      // initialize backer staking rewards params for Stratos, Cauris #2 and Alma #6
      ...backerRewardsInitTxs,

      // TODO(PR): pool tokens init principal redeemed before locking
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.5.0 deploy")
  return {
    upgradedContracts,
    params,
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
