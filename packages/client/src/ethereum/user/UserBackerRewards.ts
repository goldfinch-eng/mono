import {asNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {Loadable, WithLoadedInfo} from "../../types/loadable"
import {assertNumber, BlockInfo, defaultSum} from "../../utils"
import getWeb3 from "../../web3"
import {BackerRewardsLoaded, BackerRewardsPoolTokenPosition, BackerRewardsPosition} from "../backerRewards"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {TranchedPoolBacker} from "../tranchedPool"

export type UserBackerRewardsLoadedInfo = {
  currentBlock: BlockInfo
  positions: BackerRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
}

export type UserBackerRewardsLoaded = WithLoadedInfo<UserBackerRewards, UserBackerRewardsLoadedInfo>

export class UserBackerRewards {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserBackerRewardsLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    backerRewards: BackerRewardsLoaded,
    rewardsEligibleTranchedPoolBackers: TranchedPoolBacker[],
    currentBlock: BlockInfo
  ): Promise<void> {
    const web3 = getWeb3()
    const positions = await Promise.all(
      rewardsEligibleTranchedPoolBackers
        .filter(
          // Remove rewards-eligible tranched pools for which the user has no junior-tranche pool tokens (and for
          // which they therefore cannot earn any backer rewards).
          (backer) =>
            !!backer.tokenInfos.filter((tokenInfo) => !backer.tranchedPool.isSeniorTrancheId(tokenInfo.tranche)).length
        )
        .map(async (backer): Promise<BackerRewardsPosition> => {
          // We expect `firstDepositBlockNumber` to be non-nullable, because we have filtered out tranched pools
          // in which the user holds no pool tokens. So we expect to have found the block number of the first
          // DepositMade event corresponding to the set of pool tokens they have for this pool.
          const firstDepositBlockNumber = asNonNullable(backer.firstDepositBlockNumber)

          const [tokenPositions, firstDepositBlock] = await Promise.all([
            Promise.all(
              backer.tokenInfos.map(async (tokenInfo): Promise<BackerRewardsPoolTokenPosition> => {
                const tokenId = tokenInfo.id
                const [
                  backersOnlyClaimable,
                  seniorPoolMatchingClaimable,
                  backersOnlyTokenInfo,
                  seniorPoolMatchingClaimed,
                ] = await Promise.all([
                  backerRewards.contract.readOnly.methods
                    .poolTokenClaimableRewards(tokenId)
                    .call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods
                    .stakingRewardsEarnedSinceLastWithdraw(tokenId)
                    .call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods.tokens(tokenId).call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods
                    .stakingRewardsClaimed(tokenId)
                    .call(undefined, currentBlock.number),
                ])
                return {
                  tokenId,
                  claimed: {
                    backersOnly: new BigNumber(backersOnlyTokenInfo.rewardsClaimed),
                    seniorPoolMatching: new BigNumber(seniorPoolMatchingClaimed),
                  },
                  claimable: {
                    backersOnly: new BigNumber(backersOnlyClaimable),
                    seniorPoolMatching: new BigNumber(seniorPoolMatchingClaimable),
                  },
                  unvested: {
                    backersOnly: new BigNumber(0),
                    seniorPoolMatching: new BigNumber(0),
                  },
                }
              })
            ),
            web3.readOnly.eth.getBlock(firstDepositBlockNumber),
          ])
          const firstDepositTime = firstDepositBlock.timestamp
          assertNumber(firstDepositTime)

          const rewardsNotWithdrawableReason = backerRewards.juniorTranchePoolTokenRewardsAreNotWithdrawableReason(
            backer.tranchedPool
          )

          return new BackerRewardsPosition(backer, firstDepositTime, rewardsNotWithdrawableReason, tokenPositions)
        })
    )

    const claimable = defaultSum(positions.map((position) => position.claimable))
    const unvested = defaultSum(positions.map((position) => position.unvested))

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        positions,
        claimable,
        unvested,
      },
    }
  }
}
