export default function SeniorPoolCardSkeleton() {
  return (
    <div key="senior-pool" className="table-row background-container-inner clickable">
      <div className="table-cell col40 disabled">
        $--.--
        <span className="subheader">Total Pool Balance</span>
      </div>
      <div className="table-cell col22 numeric balance disabled">$--.--</div>
      <div className="table-cell col22 numeric limit disabled">$--.--</div>
      <div className="table-cell col16 numeric apy disabled">$--.--%</div>
    </div>
  )
}
