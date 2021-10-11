import React, {useState} from "react"
import {Link} from "react-router-dom"
import {iconCarrotDown} from "../../components/icons"

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
  return (
    <button className="table-cell col16 action" onClick={props.onClick}>
      {props.text}
    </button>
  )
}

function RewardsListItem(props) {
  // TODO: modify to get from prop
  const communityRewards = true
  const [accepted, setAccepted] = useState(communityRewards ? false : true)

  function handleAccept() {
    setAccepted(!accepted)
  }

  const valueDisabledClass = !accepted ? "disabled-text" : ""

  return (
    <li className="rewards-list-item table-row background-container clickable">
      <div className="table-cell col32">Staked 16K FIDU on Nov 1</div>
      <div className={`table-cell col20 numeric ${valueDisabledClass}`}>50.34</div>
      <div className={`table-cell col20 numeric ${valueDisabledClass}`}>4.03</div>
      {!accepted ? (
        <ActionButton text="Accept" onClick={handleAccept} />
      ) : (
        <ActionButton text="Claim GFI" onClick={() => console.log("claim action")} />
      )}
      <button className="expand">{iconCarrotDown}</button>
    </li>
  )
}

function Rewards(props) {
  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary fullyVested="0.00" stillVesting="0.00" totalGFI="0.00" totalUSD="0.00" walletBalance="0.00" />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          <div className="table-cell col20 numeric balance">Granted GFI</div>
          <div className="table-cell col20 numeric limit">Claimable GFI</div>
        </div>
        <ul className="rewards-list">
          <RewardsListItem />
        </ul>
      </div>
    </div>
  )
}

export default Rewards
