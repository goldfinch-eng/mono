import {
  BackerRewards,
  GoldfinchFactory,
  PoolTokens,
  SeniorPool,
  StakingRewards,
  TranchedPool,
} from "@goldfinch-eng/protocol/typechain/ethers"
import _ from "lodash"
import BigNumber from "bignumber.js"
import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner, TRANCHES} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export const CAURIS_NEW_ADDR = "0xFF27f53fdEC54f2077F80350c7011F76f84f9622"
export const CAURIS_OLD_ADDR = "0xa8bd929a04c1e67e5ab03c40e70e2f83238986b6"

export const ADDEM_POOL_ADDR = "0x89d7c618a4eef3065da8ad684859a547548e6169"
export const BACKER_REWARDS_PARAMS_POOL_ADDRS = [ADDEM_POOL_ADDR]
export const POOL_ADDRS_FOR_TOKEN_FIXUP = {
  [ADDEM_POOL_ADDR]: 14661577,
  "0x1d596d28a7923a22aa013b0e7082bba23daa656b": 13845045, // alma 5
  "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a": 13717428, // alma 4
  "0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae": 13597355, // Cauris
  "0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5": 13144317, // almavest 3
}

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  const poolTokens = await getEthersContract<PoolTokens>("PoolTokens")
  const goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory")

  async function getPoolTokensThatRedeemedBeforeLocking(
    poolAddress: string,
    lockBlockNumber: number
  ): Promise<{[key: string]: string}> {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const withdrawFilter = tranchedPool.filters.WithdrawalMade(undefined, TRANCHES.Junior)
    const withdrawalEventsBeforeLocking = await tranchedPool.queryFilter(withdrawFilter, undefined, lockBlockNumber)
    const withdrawEventWithdrewPrincipal = (event) => event.args.principalWithdrawn.toString() !== "0"
    const withdrawalsOfPrincipalBeforeLocked = withdrawalEventsBeforeLocking.filter(withdrawEventWithdrewPrincipal)

    const balanceByTokenId: Record<string, string> = {}
    for (const event of withdrawalsOfPrincipalBeforeLocked) {
      balanceByTokenId[event.args.tokenId.toString()] = new BigNumber(
        balanceByTokenId[event.args.tokenId.toString()] || 0
      )
        .plus(event.args.principalWithdrawn.toString())
        .toFixed()
    }

    return balanceByTokenId
  }

  const getRewardsParametersForPool = async (poolAddress: string): Promise<StakingRewardsInfoInitValues> => {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const drawdownEvents = await tranchedPool.queryFilter(tranchedPool.filters.DrawdownMade())
    const lastDrawdownBlock = Math.max(...drawdownEvents.map((e) => e.blockNumber))
    if (!lastDrawdownBlock) {
      throw new Error("Failed to Identify last drawdown block")
    }
    const trancheInfo = await tranchedPool.getTranche(TRANCHES.Junior, {blockTag: lastDrawdownBlock})
    const principalSharePrice = trancheInfo.principalSharePrice
    const principalDeposited = trancheInfo.principalDeposited
    const remaining = principalSharePrice.mul(principalDeposited).div(String(1e18))
    const backerCapitalDrawndown = principalDeposited.sub(remaining)

    const fiduSharePriceAtDrawdown = (await seniorPool.sharePrice({blockTag: lastDrawdownBlock})).toString()
    const accumulatedRewardsPerToken = (
      await stakingRewards.accumulatedRewardsPerToken({blockTag: lastDrawdownBlock})
    ).toString()

    return {
      principalDeployedAtDrawdown: backerCapitalDrawndown.toString(),
      fiduSharePriceAtDrawdown,
      accumulatedRewardsPerToken,
    }
  }

  console.log("Getting pool backer staking rewards parameters")
  const backerStakingRewardsParams = _.fromPairs(
    await Promise.all(
      BACKER_REWARDS_PARAMS_POOL_ADDRS.map(async (address) => [address, await getRewardsParametersForPool(address)])
    )
  )

  // validate against the manually confirmed values
  const expectedRewardsValues: Record<string, StakingRewardsInfoInitValues> = {
    [ADDEM_POOL_ADDR]: {
      accumulatedRewardsPerToken: "14776789414715566376",
      fiduSharePriceAtDrawdown: "1057811659464930901",
      principalDeployedAtDrawdown: "2000000000000",
    },
  }

  expect(backerStakingRewardsParams).to.deep.eq(expectedRewardsValues)
  console.log("Backer staking rewards params:")
  console.log(backerStakingRewardsParams)

  const backerStakingRewardsInitTxs = await Promise.all(
    Object.entries(backerStakingRewardsParams).map(async ([address, params]: [string, any]) => {
      return (backerRewards.populateTransaction as any).forceInitializeStakingRewardsPoolInfo(
        address,
        params.fiduSharePriceAtDrawdown,
        params.principalDeployedAtDrawdown,
        params.accumulatedRewardsPerToken
      )
    })
  )

  // Generate poolToken data fixup transactions
  console.log("Getting pool tokens that redeemed before pools were locked")
  const poolTokensWithPrincipalWithdrawnBeforeLockById: {[key: string]: string} = _.merge(
    {},
    ...(await Promise.all(
      Object.entries(POOL_ADDRS_FOR_TOKEN_FIXUP).map(([address, lockBlockNumber]) =>
        getPoolTokensThatRedeemedBeforeLocking(address, lockBlockNumber)
      )
    ))
  )
  console.log("pool token principal reduction amounts:")
  console.log(poolTokensWithPrincipalWithdrawnBeforeLockById)
  const expectedPrincipalReductionAmounts = {
    "297": "10081340000",
  }
  expect(poolTokensWithPrincipalWithdrawnBeforeLockById).to.deep.equal(expectedPrincipalReductionAmounts)

  const poolTokenFixupTxs = await Promise.all(
    Object.entries(poolTokensWithPrincipalWithdrawnBeforeLockById).map(([id, amount]) => {
      return poolTokens.populateTransaction.reducePrincipalAmount(id, amount)
    })
  )

  const deployEffects = await getDeployEffects({
    title: "v2.7.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/657",
  })

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["PoolTokens", "StakingRewards", "SeniorPool"],
  })

  // fix up pool tokens
  deployEffects.add({
    deferred: [...poolTokenFixupTxs, ...backerStakingRewardsInitTxs],
  })

  // Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  const BORROWER_ROLE = await goldfinchFactory.BORROWER_ROLE()
  const FIFTY_BASIS_POINTS = String(5e15)
  deployEffects.add({
    deferred: [
      // Set metadata base URI for PoolTokens
      await poolTokens.populateTransaction.setBaseURI(
        "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/poolTokenMetadata/"
      ),
      // Set royalty params
      await poolTokens.populateTransaction.setRoyaltyParams(await getProtocolOwner(), FIFTY_BASIS_POINTS),
      // revoke borrower role from old cauris wallet
      await goldfinchFactory.populateTransaction.revokeRole(BORROWER_ROLE, CAURIS_OLD_ADDR),
      // grant borrower role to new cauris wallet
      await goldfinchFactory.populateTransaction.grantRole(BORROWER_ROLE, CAURIS_NEW_ADDR),
    ],
  })

  const deployedContracts = {}

  // Execute effects
  await deployEffects.executeDeferred()
  console.log("Finished v2.7.0 deploy")
  return {
    upgradedContracts,
    deployedContracts,
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

interface StakingRewardsInfoInitValues {
  accumulatedRewardsPerToken: string
  fiduSharePriceAtDrawdown: string
  principalDeployedAtDrawdown: string
}
