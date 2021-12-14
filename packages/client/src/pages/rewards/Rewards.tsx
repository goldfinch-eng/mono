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
import {
  CommunityRewardsGrant,
  CommunityRewardsLoaded,
  MerkleDirectDistributorLoaded,
} from "../../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../../ethereum/gfi"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
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
        <span className="total-gfi-balance">Total GFI rewards</span>
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
          <span>{"Claimable"}</span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-claimable">
              {displayNumber(claimable ? gfiFromAtomic(claimable) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Vesting</span>
          <div>
            <span className={valueDisabledClass} data-testid="summary-still-vesting">
              {displayNumber(unvested ? gfiFromAtomic(unvested) : undefined, 2)}
            </span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total rewards</span>
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
    CommunityRewardsLoaded
  >(currentBlock, _stakingRewards, _gfi, _user, _merkleDistributor, _merkleDirectDistributor, _communityRewards)

  const disabled = session.status !== "authenticated"
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
          <h2 className="table-cell col32 title">Reward type</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance break-granted-column">Vesting GFI</div>
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
