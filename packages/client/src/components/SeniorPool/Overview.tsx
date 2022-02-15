import {SeniorPoolLoaded} from "../../ethereum/pool"
import {iconOutArrow} from "../icons"

interface OverviewProps {
  pool?: SeniorPoolLoaded
}

export function Overview(props: OverviewProps): JSX.Element {
  return (
    <div className={`pool-overview background-container senior-pool-overview ${!props.pool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        <div className="senior-pool-overview-links">
          <a href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics" target="_blank" rel="noreferrer">
            <span>How it works</span>
            {iconOutArrow}
          </a>
        </div>
      </div>
      <p className="senior-pool-overview-description">
        The Senior Pool is the simple, lower risk, lower return option on Goldfinch. Capital is automatically
        diversified across Borrower pools, and protected by Backer capital.
      </p>
      <p className="senior-pool-overview-description">
        <span className="highlights">Highlights</span>
        <ul className="highlights-list">
          <li>
            <span className="list-dot">•</span>
            <span>
              Earn passive yield. Capital is automatically deployed across a diverse portfolio of Borrowers that are
              vetted by Backers.
            </span>
          </li>
          <li>
            <span className="list-dot">•</span>
            <span>Lower risk. Losses are protected by the first-loss capital supplied by Backers.</span>
          </li>
          <li>
            <span className="list-dot">•</span>
            <span>
              Stable returns. Receive USDC APY from the underlying interest, driven by real-world activity that is
              uncorrelated with crypto, plus GFI from liquidity mining distributions.
            </span>
          </li>
        </ul>
      </p>
    </div>
  )
}
