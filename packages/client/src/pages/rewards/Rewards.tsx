import React from "react"
import BigNumber from "bignumber.js"
import {Link} from "react-router-dom"
import {gfiFromAtomic} from "../../ethereum/gfi"
import {useGFIBalance, useRewards} from "../../hooks/useStakingRewards"
import {displayDollars, displayNumber} from "../../utils"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../../components/styleConstants"
import {CommunityRewardsGrant, MerkleDistributor} from "../../ethereum/communityRewards"
import {StakingRewardsPosition, StakingRewards} from "../../ethereum/pool"
import RewardActionsContainer from "../../components/rewardActionsContainer"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"

interface RewardsSummaryProps {
  claimable: BigNumber | undefined
  unvested: BigNumber | undefined
  totalGFI: BigNumber | undefined
  totalUSD: BigNumber | undefined
  walletBalance: BigNumber | undefined
}

function RewardsSummary(props: RewardsSummaryProps) {
  const claimable = props.claimable || new BigNumber(0)
  const unvested = props.unvested || new BigNumber(0)
  const totalGFI = props.totalGFI || new BigNumber(0)
  const totalUSD = props.totalUSD || new BigNumber(0)
  const walletBalance = props.walletBalance || new BigNumber(0)

  const valueDisabledClass = totalGFI.eq(0) ? "disabled-value" : "value"

  return (
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{displayNumber(gfiFromAtomic(totalGFI), 2)}</span>
        <span className="total-usd">{displayDollars(totalUSD)}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className={valueDisabledClass}>{displayNumber(gfiFromAtomic(walletBalance), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Claimable</span>
          <div>
            <span className={valueDisabledClass}>{displayNumber(gfiFromAtomic(claimable), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className={valueDisabledClass}>{displayNumber(gfiFromAtomic(unvested), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className={valueDisabledClass}>{displayNumber(gfiFromAtomic(totalGFI), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoRewards() {
  return (
    <li className="table-row rewards-list-item no-rewards background-container">
      You have no rewards. You can earn rewards by supplying to&nbsp;
      <Link to="/pools/senior">
        <span className="senior-pool-link">pools</span>
      </Link>
      .
    </li>
  )
}

type SortableRewards =
  | {
      type: "stakingRewards"
      value: StakingRewardsPosition
    }
  | {
      type: "communityRewards"
      value: CommunityRewardsGrant
    }

const getStartTime = (sortable: SortableRewards): number => {
  switch (sortable.type) {
    case "stakingRewards":
      return sortable.value.position.rewards.startTime
    case "communityRewards":
      return sortable.value.rewards.startTime
    default:
      assertUnreachable(sortable)
  }
}
const getClaimable = (sortable: SortableRewards): BigNumber => {
  switch (sortable.type) {
    case "stakingRewards":
      return sortable.value.claimable
    case "communityRewards":
      return sortable.value.claimable
    default:
      assertUnreachable(sortable)
  }
}

function getSortedRewards(
  stakingRewards: StakingRewards | undefined,
  merkleDistributor: MerkleDistributor | undefined
): SortableRewards[] {
  /* NOTE: First order by 0 or >0 claimable rewards (0 claimable at the bottom), then group by type
   (e.g. all the staking together, then all the airdrops), then order by most recent first */
  const stakes = stakingRewards?.positions || []
  const airdrops = merkleDistributor?.communityRewards?.grants || []

  const sorted: SortableRewards[] = [
    ...stakes.map(
      (value): SortableRewards => ({
        type: "stakingRewards",
        value,
      })
    ),
    ...airdrops.map(
      (value): SortableRewards => ({
        type: "communityRewards",
        value,
      })
    ),
  ]
  sorted.sort((i1, i2) => getStartTime(i1) - getStartTime(i2))
  sorted.sort((i1, i2) => {
    const comparedByClaimable = getClaimable(i1).minus(getClaimable(i2))
    if (!comparedByClaimable.isZero()) return comparedByClaimable.isPositive() ? -1 : 1

    if (i1.type === "stakingRewards" && i2.type === "communityRewards") {
      return -1
    }

    if (i1.type === "communityRewards" && i2.type === "stakingRewards") {
      return 1
    }

    return getStartTime(i2) - getStartTime(i1)
  })
  return sorted
}

function Rewards() {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const {stakingRewards, merkleDistributor} = useRewards()
  const gfiBalance = useGFIBalance()

  let claimable: BigNumber | undefined
  let unvested: BigNumber | undefined
  let granted: BigNumber | undefined
  if (stakingRewards && merkleDistributor) {
    claimable =
      stakingRewards.claimable && merkleDistributor.claimable
        ? stakingRewards.claimable.plus(merkleDistributor.claimable)
        : undefined
    unvested =
      stakingRewards.unvested && merkleDistributor.unvested
        ? stakingRewards.unvested.plus(merkleDistributor.unvested)
        : undefined
    granted =
      stakingRewards.granted && merkleDistributor.granted
        ? stakingRewards.granted.plus(merkleDistributor.granted)
        : undefined
  }

  const rewards = getSortedRewards(stakingRewards, merkleDistributor)
  const emptyRewards =
    (!merkleDistributor?.communityRewards.grants || !merkleDistributor?.communityRewards.grants.length) &&
    (!merkleDistributor?.actionRequiredAirdrops || !merkleDistributor?.actionRequiredAirdrops.length) &&
    (!stakingRewards?.positions || !stakingRewards?.positions.length)
  const isLoaded = merkleDistributor?.loaded && stakingRewards?.loaded
  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={claimable}
        unvested={unvested}
        totalGFI={granted}
        totalUSD={
          // TODO: this needs to be updated once we have a price for GFI in USD.
          undefined
        }
        walletBalance={gfiBalance}
      />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance break-granted-column">Granted GFI</div>
              <div className="table-cell col20 numeric limit break-claimable-column">Claimable GFI</div>
            </>
          )}
        </div>
        <ul className="rewards-list">
          {!merkleDistributor || !stakingRewards || !isLoaded ? (
            <span>Loading...</span>
          ) : emptyRewards ? (
            <NoRewards />
          ) : (
            <>
              {merkleDistributor?.actionRequiredAirdrops &&
                merkleDistributor.actionRequiredAirdrops.map((item) => (
                  <RewardActionsContainer
                    key={`airdrop-${item.index}`}
                    item={item}
                    merkleDistributor={merkleDistributor}
                    stakingRewards={stakingRewards}
                  />
                ))}

              {rewards &&
                rewards.map((item) => {
                  return (
                    <RewardActionsContainer
                      key={`${item.type}-${item.value.tokenId}`}
                      item={item.value}
                      merkleDistributor={merkleDistributor}
                      stakingRewards={stakingRewards}
                    />
                  )
                })}
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
