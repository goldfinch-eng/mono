import BigNumber from "bignumber.js"
import React, {useEffect, useState} from "react"
import {Link} from "react-router-dom"
import {gfiFromAtomic} from "../../ethereum/gfi"
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
  const [claimable, setClaimable] = useState<BigNumber>()
  const [stillVesting, setStillVesting] = useState<BigNumber>()
  const [granted, setGranted] = useState<BigNumber>()
  const gfiBalance = useGFIBalance()

  useEffect(() => {
    if (!stakingRewards || !merkleDistributor || !merkleDistributor._loaded) return

    let stakes
    if (stakingRewards.totalClaimable || merkleDistributor.totalClaimable) {
      stakes = stakingRewards.totalClaimable || new BigNumber(0)
      setClaimable(stakes.plus(merkleDistributor.totalClaimable || new BigNumber(0)))
    }

    if (stakingRewards.unvested || merkleDistributor.unvested) {
      stakes = stakingRewards.unvested || new BigNumber(0)
      setStillVesting(stakes.plus(merkleDistributor.unvested || new BigNumber(0)))
    }

    if (stakingRewards.granted || merkleDistributor.granted) {
      stakes = stakingRewards.granted || new BigNumber(0)
      setGranted(stakes.plus(merkleDistributor.granted || new BigNumber(0)))
    }
  }, [stakingRewards, merkleDistributor, merkleDistributor?._loaded])

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={displayNumber(gfiFromAtomic(claimable), 2)}
        stillVesting={displayNumber(gfiFromAtomic(stillVesting), 2)}
        totalGFI={displayNumber(gfiFromAtomic(granted), 2)}
        totalUSD={displayDollars(null)} // TODO: this needs to be updated once we have a price for GFI in USD.
        walletBalance={displayNumber(gfiFromAtomic(gfiBalance), 2)}
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
