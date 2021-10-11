import React from "react"
import {Link} from "react-router-dom"

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

function Rewards(props) {
  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary fullyVested="0.00" stillVesting="0.00" totalGFI="0.00" totalUSD="0.00" walletBalance="0.00" />

      <div className="gfi-rewards">
        <h2>GFI Rewards</h2>
        <ul className="rewards-list">
          <li className="reward-list-item background-container">
            You have no rewards. You can earn rewards by supplying to{" "}
            <Link to="/pools/senior">
              <span className="senior-pool-link">pools</span>
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Rewards
