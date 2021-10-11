import React, {useState} from "react"
import {Link} from "react-router-dom"
import {iconCarrotDown} from "../../components/icons"
import {useMediaQuery} from "react-responsive"

interface RewardsSummaryProps {
  fullyVested: string
  stillVesting: string
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
          <span>Fully vested</span>
          <div>
            <span className="value">{props.fullyVested}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className="value">{props.stillVesting}</span>
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

function NoRewardsListItem(props) {
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
  const isTabletOrMobile = useMediaQuery({query: "(max-width: 900px)"})
  const disabledClass = props.disabled ? "disabled-button" : ""

  return (
    <button className={`${!isTabletOrMobile && "table-cell col16"} action ${disabledClass}`} onClick={props.onClick}>
      {props.text}
    </button>
  )
}

function RewardsListItem(props) {
  // TODO: modify to get from prop
  const communityRewards = true
  const [accepted, setAccepted] = useState(communityRewards ? false : true)
  const isTabletOrMobile = useMediaQuery({query: "(max-width: 900px)"})

  function handleAccept() {
    setAccepted(!accepted)
  }

  const valueDisabledClass = !accepted ? "disabled-text" : ""

  return (
    <>
      {isTabletOrMobile && (
        <li className="mobile-ui rewards-list-item background-container clickable">
          <div className="rewards-list-item-header">
            <div className="">Staked 16K FIDU on Nov 1</div>
            <button className="expand">{iconCarrotDown}</button>
          </div>
          <div className="item-details">
            <div className="detail-container">
              <span className="detail-label">Granted GFI</span>
              <div className={`${valueDisabledClass} detail-value`}>50.34</div>
            </div>
            <div className="detail-container">
              <span className="detail-label">Claimable GFI</span>
              <div className={`${valueDisabledClass} detail-value`}>4.03</div>
            </div>
          </div>
          {!accepted ? (
            <ActionButton text="Accept" onClick={handleAccept} />
          ) : (
            <ActionButton text="Claim GFI" onClick={() => console.log("claim action")} />
          )}
        </li>
      )}

      {!isTabletOrMobile && (
        <li className="rewards-list-item table-row background-container clickable">
          <div className="table-cell col32">Staked 16K FIDU on Nov 1</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>50.34</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>4.03</div>
          {!accepted ? (
            <ActionButton text="Accept" onClick={handleAccept} />
          ) : (
            <ActionButton text="Claim GFI" onClick={() => console.log("claim action")} disabled />
          )}
          <button className="expand">{iconCarrotDown}</button>
        </li>
      )}
    </>
  )
}

function Rewards(props) {
  const isTabletOrMobile = useMediaQuery({query: "(max-width: 900px)"})

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary fullyVested="0.00" stillVesting="0.00" totalGFI="0.00" totalUSD="0.00" walletBalance="0.00" />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance">Granted GFI</div>
              <div className="table-cell col20 numeric limit">Claimable GFI</div>
            </>
          )}
        </div>
        <ul className="rewards-list">
          <RewardsListItem />
          <RewardsListItem />
          <RewardsListItem />
          {/* <NoRewardsListItem /> */}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
