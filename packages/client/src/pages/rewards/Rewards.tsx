import BigNumber from "bignumber.js"
import React, {useEffect, useState} from "react"
import {Link} from "react-router-dom"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useGFIBalance, useRewards} from "../../hooks/useStakingRewards"
import {displayDollars, displayNumber} from "../../utils"

interface RewardsSummaryProps {
  claimable: string
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
          <span>Claimable</span>
          <div>
            <span className="value">{props.claimable}</span>
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
  const {stakingRewards, merkleDistributor} = useRewards()
  const [claimable, setClaimable] = useState<BigNumber>(new BigNumber(0))
  const [stillVesting, setStillVesting] = useState<BigNumber>(new BigNumber(0))
  const [granted, setGranted] = useState<BigNumber>(new BigNumber(0))
  const gfiBalance = useGFIBalance()

  useEffect(() => {
    if (!stakingRewards || !merkleDistributor || !merkleDistributor._loaded) return
    setClaimable(stakingRewards.totalClaimable.plus(merkleDistributor.totalClaimable))
    setStillVesting(stakingRewards.stillVesting.plus(merkleDistributor.stillVesting))
    setGranted(stakingRewards.granted.plus(merkleDistributor.granted))
  }, [stakingRewards, merkleDistributor, merkleDistributor?._loaded])

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={displayNumber(usdcFromAtomic(claimable), 2)}
        stillVesting={displayNumber(usdcFromAtomic(stillVesting), 2)}
        totalGFI={displayNumber(usdcFromAtomic(granted), 2)}
        totalUSD={displayDollars(null)}
        walletBalance={displayNumber(usdcFromAtomic(gfiBalance), 2)}
      />

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
