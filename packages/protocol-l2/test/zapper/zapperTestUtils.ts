import BN from "bn.js"
import {StakedPositionType, TRANCHES} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  FiduInstance,
  TestStakingRewardsInstance,
  TranchedPoolInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {decodeLogs, getFirstLog} from "../testHelpers"
import {DepositMade as TranchedPoolDepositMade} from "../../typechain/truffle/contracts/protocol/core/TranchedPool"
import {Staked} from "../../typechain/truffle/contracts/rewards/StakingRewards"

/**
 * Helper function to zap multiple staked positions to a tranched pool
 * @param investor address to perform the zap from
 * @param tranchedPool tranched pool instance to zap to
 * @param stakingRewardsTokenIds ids of the staked positions zap
 * @param amountsToZap amounts (in FIDU) to zap from each staked position
 * @param zapper Zapper instance
 * @param stakingRewards StakingRewards test instance
 * @returns pool token ids for each zap
 */
export const zapMultiple = async (
  investor: string,
  tranchedPool: TranchedPoolInstance,
  stakingRewardsTokenIds: BN[],
  amountsToZap: BN[],
  zapper: ZapperInstance,
  stakingRewards: TestStakingRewardsInstance
): Promise<BN[]> => {
  await Promise.all(
    stakingRewardsTokenIds.map((tokenId) => stakingRewards.approve(zapper.address, tokenId, {from: investor}))
  )

  const result = await zapper.zapMultipleToTranchedPool(
    stakingRewardsTokenIds,
    amountsToZap,
    tranchedPool.address,
    TRANCHES.Junior,
    {from: investor}
  )

  const depositEvents = await decodeLogs<TranchedPoolDepositMade>(result.receipt.rawLogs, tranchedPool, "DepositMade")

  const poolTokenIds = depositEvents.map((depositEvent) => depositEvent.args.tokenId)
  return poolTokenIds
}

/**
 * Helper function to perform a stake
 * @param investor address of staker
 * @param fiduAmount the amount to stake
 * @param stakingRewards StakingRewards test instance
 * @param fidu Fidu instance
 * @param positionType position type to stake
 * @return StakingRewards token id
 */
export const stake = async (
  investor: string,
  fiduAmount: BN,
  stakingRewards: TestStakingRewardsInstance,
  fidu: FiduInstance,
  positionType: StakedPositionType = StakedPositionType.Fidu
): Promise<BN> => {
  await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
  const receipt = await stakingRewards.stake(fiduAmount, positionType, {from: investor})
  const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args.tokenId
  return stakedTokenId
}

export const getSum = (nums: BN[]): BN => nums.reduce((x, y) => x.add(y), new BN(0))
