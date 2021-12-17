import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {isUndefined} from "lodash"
import React, {useContext} from "react"
import {useMediaQuery} from "react-responsive"
import {Link} from "react-router-dom"
import {AppContext} from "../../App"
import ConnectionNotice from "../../components/connectionNotice"
import RewardActionsContainer from "../../components/rewardActionsContainer"
import {WIDTH_TYPES} from "../../components/styleConstants"
import {CommunityRewardsGrant, CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../../ethereum/gfi"
import {MerkleDirectDistributorLoaded} from "../../ethereum/merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../../ethereum/pool"
import {
  UserCommunityRewardsLoaded,
  UserLoaded,
  UserMerkleDirectDistributorLoaded,
  UserMerkleDistributorLoaded,
} from "../../ethereum/user"
import {useFromSameBlock} from "../../hooks/useFromSameBlock"
import {useSession} from "../../hooks/useSignIn"
import {MerkleDirectDistributorGrant} from "../../types/merkleDirectDistributor"
import {NotAcceptedMerkleDistributorGrant} from "../../types/merkleDistributor"
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

type SortableMerkleDistributorRewards =
  | {type: "communityRewards"; value: CommunityRewardsGrant}
  | {type: "merkleDistributor"; value: NotAcceptedMerkleDistributorGrant}

const getMerkleDistributorGrantIndex = (sortable: SortableMerkleDistributorRewards): number | undefined => {
  switch (sortable.type) {
    case "communityRewards":
      return sortable.value.grantInfo?.index
    case "merkleDistributor":
      return sortable.value.grantInfo.index
    default:
      assertUnreachable(sortable)
  }
}

const compareStakingRewards = (a: StakingRewardsPosition, b: StakingRewardsPosition) =>
  // Order staking rewards by start time.
  a.storedPosition.rewards.startTime - b.storedPosition.rewards.startTime

const compareMerkleDistributorRewards = (a: SortableMerkleDistributorRewards, b: SortableMerkleDistributorRewards) => {
  // Order MerkleDistributor rewards by grant index.
  const aIndex = getMerkleDistributorGrantIndex(a)
  const bIndex = getMerkleDistributorGrantIndex(b)
  if (isUndefined(aIndex) && isUndefined(bIndex)) {
    return 0
  } else if (isUndefined(aIndex)) {
    return -1
  } else if (isUndefined(bIndex)) {
    return 1
  } else {
    return aIndex - bIndex
  }
}

const compareMerkleDirectDistributorGrants = (a: MerkleDirectDistributorGrant, b: MerkleDirectDistributorGrant) =>
  // Order MerkleDirectDistributor rewards by grant index.
  a.grantInfo.index - b.grantInfo.index

function Rewards() {
  const {
    stakingRewards: _stakingRewards,
    gfi: _gfi,
    user: _user,
    merkleDistributor: _merkleDistributor,
    merkleDirectDistributor: _merkleDirectDistributor,
    communityRewards: _communityRewards,
    userMerkleDistributor: _userMerkleDistributor,
    userMerkleDirectDistributor: _userMerkleDirectDistributor,
    userCommunityRewards: _userCommunityRewards,
    currentBlock,
  } = useContext(AppContext)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const session = useSession()
  const consistent = useFromSameBlock<
    StakingRewardsLoaded,
    GFILoaded,
    UserLoaded,
    MerkleDistributorLoaded,
    MerkleDirectDistributorLoaded,
    CommunityRewardsLoaded,
    UserMerkleDistributorLoaded,
    UserMerkleDirectDistributorLoaded,
    UserCommunityRewardsLoaded
  >(
    {setAsLeaf: true},
    currentBlock,
    _stakingRewards,
    _gfi,
    _user,
    _merkleDistributor,
    _merkleDirectDistributor,
    _communityRewards,
    _userMerkleDistributor,
    _userMerkleDirectDistributor,
    _userCommunityRewards
  )

  const disabled = session.status !== "authenticated"
  let loaded: boolean = false
  let claimable: BigNumber | undefined
  let unvested: BigNumber | undefined
  let totalUSD: BigNumber | undefined
  let gfiBalance: BigNumber | undefined
  let totalBalance: BigNumber | undefined
  let rewards: React.ReactNode | undefined
  if (consistent) {
    const [
      stakingRewards,
      gfi,
      user,
      merkleDistributor,
      merkleDirectDistributor,
      communityRewards,
      userMerkleDistributor,
      userMerkleDirectDistributor,
      userCommunityRewards,
    ] = consistent

    loaded = true

    const userStakingRewards = user.info.value.stakingRewards

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

    if (emptyRewards) {
      rewards = <NoRewards />
    } else {
      const sortedStakingRewards: StakingRewardsPosition[] =
        userStakingRewards.info.value.positions.sort(compareStakingRewards)
      const sortedMerkleDistributorRewards: SortableMerkleDistributorRewards[] = [
        ...userCommunityRewards.info.value.grants.map<SortableMerkleDistributorRewards>((grant) => ({
          type: "communityRewards",
          value: grant,
        })),
        ...userMerkleDistributor.info.value.airdrops.notAccepted.map<SortableMerkleDistributorRewards>((grantInfo) => ({
          type: "merkleDistributor",
          value: grantInfo,
        })),
      ].sort(compareMerkleDistributorRewards)
      const sortedMerkleDirectDistributorRewards: MerkleDirectDistributorGrant[] = [
        ...userMerkleDirectDistributor.info.value.airdrops.accepted,
        ...userMerkleDirectDistributor.info.value.airdrops.notAccepted,
      ].sort(compareMerkleDirectDistributorGrants)

      rewards = (
        <>
          {sortedStakingRewards.map((position) => (
            <RewardActionsContainer
              key={`stakingRewards-${position.tokenId}`}
              disabled={disabled}
              type="stakingRewards"
              item={position}
              user={user}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              merkleDirectDistributor={merkleDirectDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}
          {sortedMerkleDistributorRewards.map((sorted) => {
            switch (sorted.type) {
              case "communityRewards":
                return (
                  <RewardActionsContainer
                    key={`communityRewards-${sorted.value.tokenId}`}
                    disabled={disabled}
                    type="communityRewards"
                    item={sorted.value}
                    user={user}
                    gfi={gfi}
                    merkleDistributor={merkleDistributor}
                    merkleDirectDistributor={merkleDirectDistributor}
                    stakingRewards={stakingRewards}
                    communityRewards={communityRewards}
                  />
                )
              case "merkleDistributor":
                return (
                  <RewardActionsContainer
                    key={`merkleDistributor-${sorted.value.grantInfo.index}`}
                    type="merkleDistributor"
                    disabled={disabled}
                    item={sorted.value}
                    user={user}
                    gfi={gfi}
                    merkleDistributor={merkleDistributor}
                    merkleDirectDistributor={merkleDirectDistributor}
                    stakingRewards={stakingRewards}
                    communityRewards={communityRewards}
                  />
                )
              default:
                return assertUnreachable(sorted)
            }
          })}
          {sortedMerkleDirectDistributorRewards.map((sorted) => (
            <RewardActionsContainer
              key={`merkleDirectDistributor-${sorted.grantInfo.index}`}
              type="merkleDirectDistributor"
              disabled={disabled}
              item={sorted}
              user={user}
              gfi={gfi}
              merkleDistributor={merkleDistributor}
              merkleDirectDistributor={merkleDirectDistributor}
              stakingRewards={stakingRewards}
              communityRewards={communityRewards}
            />
          ))}
        </>
      )
    }
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>
      <ConnectionNotice requireUnlock={false} />
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
