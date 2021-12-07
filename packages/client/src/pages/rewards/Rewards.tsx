import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import React, {useContext} from "react"
import {useMediaQuery} from "react-responsive"
import {Link} from "react-router-dom"
import {AppContext} from "../../App"
import RewardActionsContainer from "../../components/rewardActionsContainer"
import {WIDTH_TYPES} from "../../components/styleConstants"
import {
  CommunityRewardsGrant,
  CommunityRewardsLoaded,
  MerkleDirectDistributorLoaded,
} from "../../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../../ethereum/gfi"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
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
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{displayNumber(totalGFI ? gfiFromAtomic(totalGFI) : undefined, 2)}</span>
        <span className="total-usd">{displayDollars(totalUSD)}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-wallet-balance">
              {displayNumber(walletBalance ? gfiFromAtomic(walletBalance) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>
            {
              // NOTE: We describe the value here to the user as what's vested, but the value we use is what's
              // claimable, so as to avoid double-counting any amount that had vested previously and was claimed
              // previously and that is now counted by "Wallet balance".
              "Fully vested"
            }
          </span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-claimable">
              {displayNumber(claimable ? gfiFromAtomic(claimable) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-still-vesting">
              {displayNumber(unvested ? gfiFromAtomic(unvested) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-total-balance">
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
    merkleDirectDistributor: _merkleDirectDistributor,
    communityRewards: _communityRewards,
    currentBlock,
  } = useContext(AppContext)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const consistent = useFromSameBlock<
    StakingRewardsLoaded,
    GFILoaded,
    UserLoaded,
    MerkleDistributorLoaded,
    MerkleDirectDistributorLoaded,
    CommunityRewardsLoaded
  >(
    {setAsLeaf: true},
    currentBlock,
    _stakingRewards,
    _gfi,
    _user,
    _merkleDistributor,
    _merkleDirectDistributor,
    _communityRewards
  )

  let loaded: boolean = false
  let claimable: BigNumber | undefined
  let unvested: BigNumber | undefined
  let totalUSD: BigNumber | undefined
  let gfiBalance: BigNumber | undefined
  let totalBalance: BigNumber | undefined
  let rewards: React.ReactNode | undefined
  if (consistent) {
    const stakingRewards = consistent[0]
    const gfi = consistent[1]
    const user = consistent[2]
    const merkleDistributor = consistent[3]
    const merkleDirectDistributor = consistent[4]
    const communityRewards = consistent[5]

    loaded = true

    const userStakingRewards = user.info.value.stakingRewards
    const userCommunityRewards = user.info.value.communityRewards
    const userMerkleDistributor = user.info.value.merkleDistributor
    const userMerkleDirectDistributor = user.info.value.merkleDirectDistributor
    const sortedRewards = getSortedRewards(userStakingRewards, userCommunityRewards)

    const emptyRewards =
      !userCommunityRewards.info.value.grants.length &&
      !userMerkleDistributor.info.value.airdrops.notAccepted.length &&
      !userMerkleDirectDistributor.info.value.airdrops.notAccepted.length &&
      !userMerkleDirectDistributor.info.value.airdrops.accepted.length &&
      !userStakingRewards.info.value.positions.length

    gfiBalance = user.info.value.gfiBalance
    claimable = userStakingRewards.info.value.claimable
      .plus(userCommunityRewards.info.value.claimable)
      .plus(
        // NOTE: To avoid double-counting vis-a-vis the claimable amount that is tracked by `userCommunityRewards`,
        // we do not count the claimable amount here of accepted grants; only not-accepted grants.
        userMerkleDistributor.info.value.notAcceptedClaimable
      )
      .plus(userMerkleDirectDistributor.info.value.claimable)
    unvested = userStakingRewards.info.value.unvested
      .plus(userCommunityRewards.info.value.unvested)
      .plus(
        // Same comment as for `claimable`, regarding avoiding double-counting vis-a-vis `userCommunityRewards`.
        userMerkleDistributor.info.value.notAcceptedUnvested
      )
      .plus(userMerkleDirectDistributor.info.value.unvested)

    totalBalance = gfiBalance.plus(claimable).plus(unvested)
    totalUSD = gfiInDollars(gfiToDollarsAtomic(totalBalance, gfi.info.value.price))
    rewards = emptyRewards ? (
      <NoRewards />
    ) : (
      <>
        {userMerkleDistributor &&
          userMerkleDistributor.info.value.airdrops.notAccepted.map((item) => (
            <RewardActionsContainer
              key={`merkle-distributor-airdrop-${item.grantInfo.index}`}
              type="merkleDistributor"
              item={item}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              merkleDirectDistributor={merkleDirectDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}

        {userMerkleDirectDistributor &&
          userMerkleDirectDistributor.info.value.airdrops.notAccepted.map((item) => (
            <RewardActionsContainer
              key={`merkle-direct-distributor-airdrop-${item.grantInfo.index}`}
              type="merkleDirectDistributor"
              item={item}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              merkleDirectDistributor={merkleDirectDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}
        {userMerkleDirectDistributor &&
          userMerkleDirectDistributor.info.value.airdrops.accepted.map((item) => (
            <RewardActionsContainer
              key={`merkle-direct-distributor-airdrop-${item.grantInfo.index}`}
              type="merkleDirectDistributor"
              item={item}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              merkleDirectDistributor={merkleDirectDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}

        {sortedRewards &&
          sortedRewards.map((item) => {
            switch (item.type) {
              case "communityRewards":
                return (
                  <RewardActionsContainer
                    key={`${item.type}-${item.value.tokenId}`}
                    type={item.type}
                    item={item.value}
                    gfi={gfi}
                    merkleDistributor={merkleDistributor}
                    merkleDirectDistributor={merkleDirectDistributor}
                    stakingRewards={stakingRewards}
                    communityRewards={communityRewards}
                  />
                )
              case "stakingRewards":
                return (
                  <RewardActionsContainer
                    key={`${item.type}-${item.value.tokenId}`}
                    type={item.type}
                    item={item.value}
                    gfi={gfi}
                    merkleDistributor={merkleDistributor}
                    merkleDirectDistributor={merkleDirectDistributor}
                    stakingRewards={stakingRewards}
                    communityRewards={communityRewards}
                  />
                )
              default:
                return assertUnreachable(item)
            }
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
        walletBalance={gfiBalance}
        claimable={claimable}
        unvested={unvested}
        totalGFI={totalBalance}
        totalUSD={totalUSD}
      />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance break-granted-column">Granted GFI</div>
              <div className="table-cell col20 numeric limit break-claimable-column">
                {
                  // NOTE: Consistently with our approach in the rewards summary and rewards list item
                  // details, we describe the value to the user here as what's vested, though the value
                  // we use is what's claimable. What's claimable is the relevant piece of information
                  // that informs their understanding of whether they should be able to take any action
                  // with the list item button.
                  "Vested GFI"
                }
              </div>
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
