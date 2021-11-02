import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import React, {useContext} from "react"
import {useMediaQuery} from "react-responsive"
import {Link} from "react-router-dom"
import {AppContext} from "../../App"
import RewardActionsContainer from "../../components/rewardActionsContainer"
import {WIDTH_TYPES} from "../../components/styleConstants"
import {CommunityRewardsGrant, CommunityRewardsLoaded, MerkleDistributorLoaded} from "../../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../../ethereum/gfi"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../../ethereum/pool"
import {UserCommunityRewardsLoaded, UserLoaded, UserStakingRewardsLoaded} from "../../ethereum/user"
import {useFromSameBlock} from "../../hooks/useFromSameBlock"
import {displayDollars, displayNumber} from "../../utils"

interface RewardsSummaryProps {
  claimable: BigNumber | undefined
  unvested: BigNumber | undefined
  totalGFI: BigNumber | undefined
  totalUSD: BigNumber | undefined
  walletBalance: BigNumber | undefined
}

function RewardsSummary(props: RewardsSummaryProps) {
  const {claimable, unvested, totalGFI, totalUSD, walletBalance} = props

  const valueDisabledClass = totalGFI && totalGFI.gt(0) ? "value" : "disabled-value"

  return (
    <div className="rewards-summary background-container" data-testid="rewards-summary">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{displayNumber(totalGFI ? gfiFromAtomic(totalGFI) : undefined, 2)}</span>
        <span className="total-usd">{displayDollars(totalUSD)}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className={valueDisabledClass}>
              {displayNumber(walletBalance ? gfiFromAtomic(walletBalance) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Claimable</span>
          <div>
            <span className={valueDisabledClass}>
              {displayNumber(claimable ? gfiFromAtomic(claimable) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className={valueDisabledClass}>
              {displayNumber(unvested ? gfiFromAtomic(unvested) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className={valueDisabledClass}>
              {displayNumber(totalGFI ? gfiFromAtomic(totalGFI) : undefined, 2)}
            </span>
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
      return sortable.value.storedPosition.rewards.startTime
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
  userStakingRewards: UserStakingRewardsLoaded,
  userCommunityRewards: UserCommunityRewardsLoaded
): SortableRewards[] {
  /* NOTE: First order by 0 or >0 claimable rewards (0 claimable at the bottom), then group by type
   (e.g. all the staking together, then all the airdrops), then order by most recent first */
  const stakes = userStakingRewards.info.value.positions
  const grants = userCommunityRewards.info.value.grants

  const sorted: SortableRewards[] = [
    ...stakes.map(
      (value): SortableRewards => ({
        type: "stakingRewards",
        value,
      })
    ),
    ...grants.map(
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
  const {
    stakingRewards: _stakingRewards,
    gfi: _gfi,
    user: _user,
    merkleDistributor: _merkleDistributor,
    communityRewards: _communityRewards,
    currentBlock,
  } = useContext(AppContext)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const consistent = useFromSameBlock<
    StakingRewardsLoaded,
    GFILoaded,
    UserLoaded,
    MerkleDistributorLoaded,
    CommunityRewardsLoaded
  >(currentBlock, _stakingRewards, _gfi, _user, _merkleDistributor, _communityRewards)

  let loaded: boolean = false
  let claimable: BigNumber | undefined
  let unvested: BigNumber | undefined
  let granted: BigNumber | undefined
  let totalUSD: BigNumber | undefined
  let gfiBalance: BigNumber | undefined
  let rewards: React.ReactNode | undefined
  if (consistent) {
    const stakingRewards = consistent[0]
    const gfi = consistent[1]
    const user = consistent[2]
    const merkleDistributor = consistent[3]
    const communityRewards = consistent[4]

    loaded = true

    const userStakingRewards = user.info.value.stakingRewards
    const userCommunityRewards = user.info.value.communityRewards
    const userMerkleDistributor = user.info.value.merkleDistributor
    const sortedRewards = getSortedRewards(userStakingRewards, userCommunityRewards)

    const emptyRewards =
      !userCommunityRewards.info.value.grants.length &&
      !userMerkleDistributor.info.value.airdrops.notAccepted.length &&
      !userStakingRewards.info.value.positions.length

    claimable = userStakingRewards.info.value.claimable.plus(userCommunityRewards.info.value.claimable)
    unvested = userStakingRewards.info.value.unvested.plus(userCommunityRewards.info.value.unvested)
    granted = userStakingRewards.info.value.granted.plus(userCommunityRewards.info.value.granted)

    gfiBalance = user.info.value.gfiBalance

    totalUSD = gfiInDollars(gfiToDollarsAtomic(granted, gfi.info.value.price))
    rewards = emptyRewards ? (
      <NoRewards />
    ) : (
      <>
        {userMerkleDistributor &&
          userMerkleDistributor.info.value.airdrops.notAccepted.map((item) => (
            <RewardActionsContainer
              key={`airdrop-${item.index}`}
              item={item}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}

        {sortedRewards &&
          sortedRewards.map((item) => {
            return (
              <RewardActionsContainer
                key={`${item.type}-${item.value.tokenId}`}
                item={item.value}
                gfi={gfi}
                merkleDistributor={merkleDistributor}
                stakingRewards={stakingRewards}
                communityRewards={communityRewards}
              />
            )
          })}
      </>
    )
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={claimable}
        unvested={unvested}
        totalGFI={granted}
        totalUSD={totalUSD}
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
        <ul className="rewards-list" data-testid="rewards-list">
          {loaded ? rewards : <span>Loading...</span>}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
