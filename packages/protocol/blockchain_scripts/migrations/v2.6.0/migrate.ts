import {PAUSER_ROLE, StakedPositionType, TRANCHES} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  BackerRewards,
  GFI,
  Go,
  GoldfinchConfig,
  GoldfinchFactory,
  PoolTokens,
  SeniorPool,
  StakingRewards,
  TranchedPool,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import _ from "lodash"
import BigNumber from "bignumber.js"
import hre from "hardhat"
import {deployFixedLeverageRatioStrategy} from "../../baseDeploy/deployFixedLeverageRatioStrategy"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"
import {deployZapper} from "../../baseDeploy/deployZapper"
import {CONFIG_KEYS} from "../../configKeys"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  ZAPPER_ROLE,
} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export const EMERGENCY_PAUSER_ADDR = "0x061e0b0087a01127554ffef8f9c4c6e9447ad9dd"
const STRATOS_POOL_ADDR = "0x00c27fc71b159a346e179b4a1608a0865e8a7470"
const ALMA_6_POOL_ADDR = "0x418749e294cabce5a714efccc22a8aade6f9db57"
const ALMA_7_POOL_ADDR = "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3"
const CAURIS_2_POOL_ADDR = "0xd09a57127bc40d680be7cb061c2a6629fe71abef"
const LEND_EAST_POOL_ADDR = "0xb26b42dd5771689d0a7faeea32825ff9710b9c11"
export const BACKER_REWARDS_PARAMS_POOL_ADDRS = [
  STRATOS_POOL_ADDR,
  ALMA_6_POOL_ADDR,
  ALMA_7_POOL_ADDR,
  CAURIS_2_POOL_ADDR,
  LEND_EAST_POOL_ADDR,
]

export type Migration260Params = {
  BackerRewards: {
    totalRewards: string
  }
  StakingRewards: {
    curveEffectiveMultiplier: string
  }
}

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const deployEffects = await getDeployEffects({
    title: "v2.6.0 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/390",
  })

  async function getPoolTokensThatRedeemedBeforeLocking(poolAddress: string): Promise<{[key: string]: string}> {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const lockEvents = await tranchedPool.queryFilter(tranchedPool.filters.TrancheLocked(tranchedPool.address))
    const isJuniorTrancheLockEvent = (event) => event.args.trancheId.toNumber() === TRANCHES.Junior
    const juniorLockEvents = lockEvents.filter(isJuniorTrancheLockEvent)
    if (juniorLockEvents.length !== 2) {
      throw new Error(`Unexpected junior tranche lock events found.`)
    }

    const lockBlockNumber = juniorLockEvents.reduce<number>((acc, x) => Math.max(acc, x.blockNumber), 0)
    if (!lockBlockNumber) {
      throw new Error("Failed to identify lock block number.")
    }

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

  const owner = await getProtocolOwner()
  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  const go = await getEthersContract<Go>("Go")
  const poolTokens = await getEthersContract<PoolTokens>("PoolTokens")
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity")
  const goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory")

  const getRewardsParametersForPool = async (poolAddress: string): Promise<StakingRewardsInfoInitValues> => {
    const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})
    const drawdownEvents = await tranchedPool.queryFilter(tranchedPool.filters.DrawdownMade())
    // in some cases (stratos) they did a test drawdown. If we used the first drawdown
    // as where to take our rewards param snapshot we would have incorrect values. So we need to find
    // the latest block that they drewdown.
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

  console.log("Beginning v2.6.0 upgrade")

  // 1. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards", "SeniorPool", "StakingRewards", "CommunityRewards", "PoolTokens"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // 3. Deploy upgraded tranched pool
  const tranchedPool = await deployTranchedPool(deployer, {config, deployEffects})

  // 4. deploy upgraded fixed leverage ratio strategy
  const fixedLeverageRatioStrategy = await deployFixedLeverageRatioStrategy(deployer, {config, deployEffects})

  // 5. deploy zapper
  const zapper = await deployZapper(deployer, {config, deployEffects})
  const deployedContracts = {
    tranchedPool,
    fixedLeverageRatioStrategy,
    zapper,
  }

  const params: Migration260Params = {
    BackerRewards: {
      totalRewards: new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.005").toFixed(),
    },
    StakingRewards: {
      curveEffectiveMultiplier: "750000000000000000",
    },
  }

  console.log(
    `Transferring ${params.BackerRewards.totalRewards} GFI to BackerRewards at address ${backerRewards.address}`
  )
  console.log("Setting StakingRewards parameters:")
  console.log(` effectiveMultipler = ${params.StakingRewards.curveEffectiveMultiplier}`)

  // 6. Generate rewards initialization params
  console.log("Getting pool backer staking rewards parameters")
  const backerStakingRewardsParams = _.fromPairs(
    await Promise.all(
      BACKER_REWARDS_PARAMS_POOL_ADDRS.map(async (address) => [address, await getRewardsParametersForPool(address)])
    )
  )

  // validate against the manually confirmed values
  const expectedRewardsValues: Record<string, StakingRewardsInfoInitValues> = {
    [STRATOS_POOL_ADDR]: {
      principalDeployedAtDrawdown: "4000000000000",
      fiduSharePriceAtDrawdown: "1049335199989661790",
      accumulatedRewardsPerToken: "14764838139349853151",
    },
    [ALMA_6_POOL_ADDR]: {
      principalDeployedAtDrawdown: "2362453454437",
      fiduSharePriceAtDrawdown: "1048979727966257806",
      accumulatedRewardsPerToken: "14764765626591738655",
    },
    [ALMA_7_POOL_ADDR]: {
      principalDeployedAtDrawdown: "1999999998834",
      fiduSharePriceAtDrawdown: "1055955666945103145",
      accumulatedRewardsPerToken: "14774486589523186250",
    },
    [CAURIS_2_POOL_ADDR]: {
      principalDeployedAtDrawdown: "2000000000001",
      fiduSharePriceAtDrawdown: "1049335199989661790",
      accumulatedRewardsPerToken: "14765542624996072988",
    },
    [LEND_EAST_POOL_ADDR]: {
      principalDeployedAtDrawdown: "2030000000000",
      fiduSharePriceAtDrawdown: "1052477362957198335",
      accumulatedRewardsPerToken: "14770629091940940209",
    },
  }

  expect(backerStakingRewardsParams).to.deep.eq(expectedRewardsValues)
  console.log("Backer staking rewards params:")
  console.log(backerStakingRewardsParams)

  const backerStakingRewardsInitTxs = await Promise.all(
    Object.entries(backerStakingRewardsParams).map(async ([address, params]) => {
      return backerRewards.populateTransaction.forceInitializeStakingRewardsPoolInfo(
        address,
        params.fiduSharePriceAtDrawdown,
        params.principalDeployedAtDrawdown,
        params.accumulatedRewardsPerToken
      )
    })
  )

  // 7. Generate poolToken data fixup transactions
  console.log("Getting pool tokens that redeemed before pools were locked")
  const poolTokensWithPrincipalWithdrawnBeforeLockById: {[key: string]: string} = _.merge(
    {},
    ...(await Promise.all(BACKER_REWARDS_PARAMS_POOL_ADDRS.map(getPoolTokensThatRedeemedBeforeLocking)))
  )
  console.log("pool token principal reduction amounts:")
  console.log(poolTokensWithPrincipalWithdrawnBeforeLockById)

  const expectedPrincipalReductionAmounts = {
    "469": "9000000000",
    "477": "6500000000",
    "478": "37980320915",
    "485": "16556876430",
    "487": "25500000000",
    "493": "10000000000",
    "501": "4000000000",
    "507": "1020000000",
    "517": "2000000000",
    "518": "16870422655",
    "525": "1000000000",
    "545": "30000810000",
    "566": "4000000000",
    "689": "129117730000",
    "711": "476510000",
  }

  expect(poolTokensWithPrincipalWithdrawnBeforeLockById).to.deep.equal(expectedPrincipalReductionAmounts)

  const poolTokenFixupTxs = await Promise.all(
    Object.entries(poolTokensWithPrincipalWithdrawnBeforeLockById).map(([id, amount]) => {
      return poolTokens.populateTransaction.reducePrincipalAmount(id, amount)
    })
  )

  // 8. Add effects to deploy effects
  deployEffects.add({
    deferred: [
      // set Goldfinchconfig key for fidu usdc lp pool
      await config.populateTransaction.setAddress(CONFIG_KEYS.FiduUSDCCurveLP, MAINNET_FIDU_USDC_CURVE_LP_ADDRESS),

      // init zapper roles
      await stakingRewards.populateTransaction.initZapperRole(),
      await stakingRewards.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await seniorPool.populateTransaction.initZapperRole(),
      await seniorPool.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),
      await go.populateTransaction.initZapperRole(),
      await go.populateTransaction.grantRole(ZAPPER_ROLE, zapper.address),

      // load GFI into backer rewards
      await gfi.populateTransaction.approve(owner, params.BackerRewards.totalRewards),
      await gfi.populateTransaction.transferFrom(owner, backerRewards.address, params.BackerRewards.totalRewards),

      // initialize staking rewards parameters for CurveLP positions
      await stakingRewards.populateTransaction.setEffectiveMultiplier(
        params.StakingRewards.curveEffectiveMultiplier,
        StakedPositionType.CurveLP
      ),

      await backerRewards.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await uniqueIdentity.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await goldfinchFactory.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await zapper.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await go.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),

      ...backerStakingRewardsInitTxs,
      ...poolTokenFixupTxs,
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.6.0 deploy")
  return {
    upgradedContracts,
    deployedContracts,
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

interface StakingRewardsInfoInitValues {
  accumulatedRewardsPerToken: string
  fiduSharePriceAtDrawdown: string
  principalDeployedAtDrawdown: string
}
