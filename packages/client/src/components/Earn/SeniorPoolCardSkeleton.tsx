export default function SeniorPoolCardSkeleton() {
  return (
    <div key="senior-pool" className="table-row background-container-inner clickable">
      <div className="table-cell col40 pool-info fallback-content">
        <div className="circle-icon" />
        <div className="name">
          <span>Loading...</span>
        </div>
      </div>
      <div className="table-cell col22 numeric apy disabled">$--.--%</div>
      <div className="table-cell col22 numeric limit disabled">$--.--</div>
      <div className="table-cell col22 numeric balance disabled">$--.--</div>
    </div>
  )
}
