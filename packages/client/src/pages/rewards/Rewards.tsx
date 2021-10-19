import React, {useState} from "react"
import BigNumber from "bignumber.js"
import {Link} from "react-router-dom"
import {gfiFromAtomic} from "../../ethereum/gfi"
import {useGFIBalance, useRewards} from "../../hooks/useStakingRewards"
import {displayDollars, displayNumber} from "../../utils"
import {iconCarrotDown} from "../../components/icons"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../../components/styleConstants"

interface RewardsSummaryProps {
  claimable: string
  unvested: string
  totalGFI: string
  totalUSD: string
  walletBalance: string
}

function RewardsSummary(props: RewardsSummaryProps) {
  return (
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{props.totalGFI}</span>
        <span className="total-usd">${props.totalUSD}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className="value">{props.walletBalance}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Claimable</span>
          <div>
            <span className="value">{props.claimable}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className="value">{props.unvested}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className="value">{props.totalGFI}</span>
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
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const disabledClass = props.disabled ? "disabled-button" : ""

  return (
    <button className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`} onClick={props.onClick}>
      {props.text}
    </button>
  )
}

interface RewardsListItemProps {
  isCommunityRewards: boolean
  title: string
  grantedGFI: string
  claimableGFI: string
}

function RewardsListItem(props: RewardsListItemProps) {
  const [accepted, setAccepted] = useState(props.isCommunityRewards ? false : true)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})

  function handleAccept() {
    setAccepted(!accepted)
  }

  const valueDisabledClass = !accepted ? "disabled-text" : ""

  const actionButtonComponent = !accepted ? (
    <ActionButton text="Accept" onClick={handleAccept} />
  ) : (
    <ActionButton
      text="Claim GFI"
      onClick={() => console.log("claim action")}
      disabled={props.claimableGFI === "0.00"}
    />
  )

  return (
    <>
      {!isTabletOrMobile && (
        <li className="rewards-list-item table-row background-container clickable">
          <div className="table-cell col32">{props.title}</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>{props.grantedGFI}</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>{props.claimableGFI}</div>
          {actionButtonComponent}
          <button className="expand">{iconCarrotDown}</button>
        </li>
      )}

      {isTabletOrMobile && (
        <li className="rewards-list-item background-container clickable mobile">
          <div className="item-header">
            <div>{props.title}</div>
            <button className="expand">{iconCarrotDown}</button>
          </div>
          <div className="item-details">
            <div className="detail-container">
              <span className="detail-label">Granted GFI</span>
              <div className={`${valueDisabledClass}`}>{props.grantedGFI}</div>
            </div>
            <div className="detail-container">
              <span className="detail-label">Claimable GFI</span>
              <div className={`${valueDisabledClass}`}>{props.claimableGFI}</div>
            </div>
          </div>
          {actionButtonComponent}
        </li>
      )}
    </>
  )
}

function Rewards(props) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})

  // TODO: remove this variable when getting real data
  const gfiRewards = [
    {
      isCommunityRewards: false,
      title: "Staked 16K FIDU on Nov 1",
      grantedGFI: "50.34",
      claimableGFI: "4.03",
    },
    {
      isCommunityRewards: true,
      title: "Flight Academy Reward",
      grantedGFI: "12,500.00",
      claimableGFI: "0.00",
    },
    {
      isCommunityRewards: true,
      title: "Liquidity Provider Airdrop",
      grantedGFI: "100,000.00",
      claimableGFI: "50,000.00",
    },
  ]

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

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={displayNumber(gfiFromAtomic(claimable), 2)}
        unvested={displayNumber(gfiFromAtomic(unvested), 2)}
        totalGFI={displayNumber(gfiFromAtomic(granted), 2)}
        totalUSD={displayDollars(null)} // TODO: this needs to be updated once we have a price for GFI in USD.
        walletBalance={displayNumber(gfiFromAtomic(gfiBalance), 2)}
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
          {gfiRewards.length === 0 && <NoRewards />}

          {gfiRewards.length > 0 &&
            gfiRewards.map((item) => (
              <RewardsListItem
                key={item.title}
                isCommunityRewards={item.isCommunityRewards}
                title={item.title}
                grantedGFI={item.grantedGFI}
                claimableGFI={item.claimableGFI}
              />
            ))}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
