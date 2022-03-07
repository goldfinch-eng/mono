import {TranchedPool} from "../../ethereum/tranchedPool"

export function BorrowerOverview({tranchedPool}: {tranchedPool: TranchedPool}) {
  const highlights = tranchedPool.metadata?.borrowerHighlights

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Borrower Overview</h2>
      </div>
      <p className="pool-description pool-borrower-description">{tranchedPool.metadata?.borrowerDescription}</p>
      {highlights && highlights.length > 0 && (
        <div className="pool-highlights pool-borrower-description">
          <h3>Highlights</h3>
          <p>
            {highlights.map((el) => {
              return <span className="pool-highlight">{el}</span>
            })}
          </p>
        </div>
      )}
    </div>
  )
}
