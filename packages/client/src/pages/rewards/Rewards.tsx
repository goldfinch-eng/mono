import React, {useState} from "react"
import _ from "lodash"
import BigNumber from "bignumber.js"
import {Link} from "react-router-dom"
import {gfiFromAtomic} from "../../ethereum/gfi"
import {useGFIBalance, useRewards} from "../../hooks/useStakingRewards"
import {displayDollars, displayNumber} from "../../utils"
import {iconCarrotDown} from "../../components/icons"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../../components/styleConstants"
import {CommunityRewards, CommunityRewardsVesting, MerkleDistributor} from "../../ethereum/communityRewards"
import {StakedPosition, StakingRewards} from "../../ethereum/pool"
import useSendFromUser from "../../hooks/useSendFromUser"

interface RewardsSummaryProps {
  claimable: BigNumber
  unvested: BigNumber
  totalGFI: BigNumber
  totalUSD: BigNumber
  walletBalance: BigNumber
}

function RewardsSummary(props: RewardsSummaryProps) {
  return (
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{displayNumber(gfiFromAtomic(props.totalGFI), 2)}</span>
        <span className="total-usd">${displayDollars(props.totalUSD)}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(props.walletBalance), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Claimable</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(props.claimable), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(props.unvested), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(props.totalGFI), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoRewards(props) {
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

function ActionButton(props) {
  const [isPending, setIsPending] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const disabledClass = props.disabled || isPending ? "disabled-button" : ""

  async function action() {
    setIsPending(true)
    await props.onClick()
    setIsPending(false)
  }

  return (
    <button className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`} onClick={action}>
      {isPending ? props.pendingText : props.text}
    </button>
  )
}

interface RewardsListItemProps {
  isAcceptRequired: boolean
  title: string
  grantedGFI: BigNumber
  claimableGFI: BigNumber
  children: JSX.Element
}

function RewardsListItem(props: RewardsListItemProps) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const valueDisabledClass = props.isAcceptRequired ? "disabled-text" : ""

  function capitalizeTitle(reason: string): string {
    return reason
      .split("_")
      .map((s) => _.capitalize(s))
      .join(" ")
  }

  return (
    <>
      {!isTabletOrMobile && (
        <li className="rewards-list-item table-row background-container clickable">
          <div className="table-cell col32">{capitalizeTitle(props.title)}</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
            {displayNumber(gfiFromAtomic(props.grantedGFI), 2)}
          </div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
            {displayNumber(gfiFromAtomic(props.claimableGFI), 2)}
          </div>
          {props.children}
          <button className="expand">{iconCarrotDown}</button>
        </li>
      )}

      {isTabletOrMobile && (
        <li className="rewards-list-item background-container clickable mobile">
          <div className="item-header">
            <div>{capitalizeTitle(props.title)}</div>
            <button className="expand">{iconCarrotDown}</button>
          </div>
          <div className="item-details">
            <div className="detail-container">
              <span className="detail-label">Granted GFI</span>
              <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.grantedGFI), 2)}</div>
            </div>
            <div className="detail-container">
              <span className="detail-label">Claimable GFI</span>
              <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.claimableGFI), 2)}</div>
            </div>
          </div>
          {props.children}
        </li>
      )}
    </>
  )
}

function getSortedRewards(
  stakingRewards: StakingRewards | undefined,
  merkleDistributor: MerkleDistributor | undefined
): (StakedPosition | CommunityRewardsVesting)[] {
  /* NOTE: First order by 0 or >0 claimable rewards (0 claimable at the bottom), then group by type
   (e.g. all the staking together, then all the airdrops), then order by most recent first */
  const stakes = stakingRewards?.positions || []
  const airdrops = merkleDistributor?.communityRewards?.grants || []

  const rewards: (StakedPosition | CommunityRewardsVesting)[] = [...stakes, ...airdrops]
  rewards.sort((i1, i2) => {
    let val = i1.claimable.minus(i2.claimable)
    if (!val.isZero()) return val.isNegative() ? -1 : 1

    if (i1 instanceof StakedPosition && i2 instanceof CommunityRewardsVesting) {
      return 1
    }

    if (i1 instanceof CommunityRewardsVesting && i2 instanceof StakedPosition) {
      return -1
    }

    if (i1 instanceof StakedPosition && i2 instanceof StakedPosition) {
      return i2.rewards.startTime - i1.rewards.startTime
    }

    return i2.rewards.startTime - i1.rewards.startTime
  })
  return rewards
}

function Rewards(props) {
  const sendFromUser = useSendFromUser()
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const {stakingRewards, merkleDistributor} = useRewards()
  const gfiBalance = useGFIBalance()

  let claimable
  let unvested
  let granted
  if (stakingRewards?.totalClaimable || merkleDistributor?.totalClaimable) {
    let val = stakingRewards?.totalClaimable || new BigNumber(0)
    claimable = val.plus(merkleDistributor?.totalClaimable || new BigNumber(0))
  }

  if (stakingRewards?.unvested || merkleDistributor?.unvested) {
    let val = stakingRewards?.unvested || new BigNumber(0)
    unvested = val.plus(merkleDistributor?.unvested || new BigNumber(0))
  }

  if (stakingRewards?.granted || merkleDistributor?.granted) {
    let val = stakingRewards?.granted || new BigNumber(0)
    granted = val.plus(merkleDistributor?.granted || new BigNumber(0))
  }

  async function handleAccept(info) {
    if (!merkleDistributor) return
    return sendFromUser(
      merkleDistributor.contract.methods.acceptGrant(
        info.index,
        info.account,
        info.grant.amount,
        info.grant.vestingLength,
        info.grant.cliffLength,
        info.grant.vestingInterval,
        info.proof
      ),
      {
        type: "Accept",
        amount: gfiFromAtomic(info.grant.amount),
      }
    )
  }

  async function handleClaim(
    rewards: CommunityRewards | StakingRewards | undefined,
    tokenId: string,
    amount: BigNumber
  ) {
    if (!rewards) return

    const amountString = amount.toString(10)
    return sendFromUser(rewards.contract.methods.getReward(tokenId), {
      type: "Claim",
      amount: amountString,
    })
  }

  const rewards = getSortedRewards(stakingRewards, merkleDistributor)
  const emptyRewards =
    (!merkleDistributor?.communityRewards.grants &&
      !merkleDistributor?.actionRequiredAirdrops &&
      !stakingRewards?.positions) ||
    (!merkleDistributor?.communityRewards?.grants?.length &&
      !merkleDistributor?.actionRequiredAirdrops?.length &&
      !stakingRewards?.positions?.length)
  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={claimable}
        unvested={unvested}
        totalGFI={granted}
        totalUSD={new BigNumber("")} // TODO: this needs to be updated once we have a price for GFI in USD.
        walletBalance={gfiBalance || new BigNumber(0)}
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
          {merkleDistributor?.loaded && stakingRewards?.loaded && emptyRewards ? (
            <NoRewards />
          ) : (
            <>
              {merkleDistributor?.actionRequiredAirdrops &&
                merkleDistributor.actionRequiredAirdrops.map((item) => (
                  <RewardsListItem
                    key={`${item.reason}-${item.index}`}
                    isAcceptRequired={true}
                    title={item.reason}
                    grantedGFI={new BigNumber(item.grant.amount)}
                    claimableGFI={new BigNumber(0)}
                  >
                    <ActionButton text="Accept" pendingText="Accepting..." onClick={() => handleAccept(item)} />
                  </RewardsListItem>
                ))}

              {rewards &&
                rewards.map((item) => {
                  return (
                    <RewardsListItem
                      key={`staked-${item.rewards.startTime}`}
                      isAcceptRequired={false}
                      title={item.reason}
                      grantedGFI={item.granted}
                      claimableGFI={item.claimable}
                    >
                      {item.rewards.totalClaimed.isEqualTo(item.granted) && !item.granted.eq(0) ? (
                        <ActionButton text="Claimed" onClick={_.noop} disabled />
                      ) : item instanceof CommunityRewardsVesting ? (
                        <ActionButton
                          text="Claim GFI"
                          pendingText="Claiming..."
                          onClick={() => handleClaim(merkleDistributor?.communityRewards, item.tokenId, item.claimable)}
                          disabled={item.claimable.eq(0)}
                        />
                      ) : (
                        <ActionButton
                          text="Claim GFI"
                          pendingText="Claiming..."
                          onClick={() => handleClaim(stakingRewards, item.tokenId, item.claimable)}
                          disabled={item.claimable.eq(0)}
                        />
                      )}
                    </RewardsListItem>
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
