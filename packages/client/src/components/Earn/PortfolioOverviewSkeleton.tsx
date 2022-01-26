export default function PortfolioOverviewSkeleton() {
  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value disabled">$--.--</div>
          <div className="sub-value disabled">--.-- (--.--%)</div>
        </div>
        <div className="deposit-status-item">
          <div className="label">Est. Annual Growth</div>

          <div className="value disabled">$--.--</div>
          <div className="sub-value disabled">--.--% APY</div>
        </div>
      </div>
    </div>
  )
}
