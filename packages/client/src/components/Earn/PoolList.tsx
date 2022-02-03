export default function PoolList({title, subtitle, children}) {
  return (
    <div className="pools-list table-spaced background-container">
      <div className="title">{title}</div>
      <div className="subtitle">{subtitle}</div>
      <div className="table-header background-container-inner">
        <div className="table-cell col40">Pool</div>
        <div className="table-cell col16 numeric apy">Est. APY</div>
        <div className="table-cell col22 numeric limit">Pool Limit</div>
        <div className="table-cell col22 numeric balance">Your Balance</div>
      </div>
      {children}
    </div>
  )
}
