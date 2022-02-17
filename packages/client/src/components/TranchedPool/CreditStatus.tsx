import moment from "moment"
import {useContext} from "react"
import {useMediaQuery} from "react-responsive"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {TranchedPool} from "../../ethereum/tranchedPool"
import {useBacker} from "../../hooks/useTranchedPool"
import {displayDollars, displayDollarsTruncated} from "../../utils"
import {iconOutArrow} from "../icons"
import InfoSection from "../infoSection"
import {WIDTH_TYPES} from "../styleConstants"
import {useRecentPoolTransactions} from "./hooks/useRecentPoolTransactions"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {DRAWDOWN_MADE_EVENT, PAYMENT_APPLIED_EVENT} from "../../types/events"

export function CreditStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  const {user, currentBlock} = useContext(AppContext)
  const transactions = useRecentPoolTransactions({tranchedPool, currentBlock})
  const backer = useBacker({user, tranchedPool})
  const isMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenM})`})

  // Don't show the credit status component until the pool has a drawdown
  if (!backer || !tranchedPool || (transactions.length === 0 && !tranchedPool.isMigrated)) {
    return <></>
  }
  let creditLine = tranchedPool.creditLine

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Principal Outstanding",
      value: displayDollars(usdcFromAtomic(creditLine.balance)),
    },
    {
      label: "Your principal portion",
      value: displayDollars(usdcFromAtomic(backer.principalAmount)),
    },
    {
      label: "Full repayment due",
      value: creditLine.termEndDate,
    },
  ]

  let transactionRows
  if (transactions.length === 0) {
    transactionRows = (
      <tr className="empty-row">
        <td>No transactions</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    )
  } else {
    transactionRows = transactions.map((tx) => {
      let yourPortion: BigNumber, amount: string
      if (tx.event === PAYMENT_APPLIED_EVENT) {
        amount = tx.amount.display
        const interestPortion = tranchedPool.sharePriceToUSDC(tx.juniorInterestDelta, backer.principalAmount)
        const principalPortion = tranchedPool.sharePriceToUSDC(tx.juniorPrincipalDelta, backer.principalAmount)
        yourPortion = interestPortion.plus(principalPortion)
      } else if (tx.event === DRAWDOWN_MADE_EVENT) {
        amount = tx.amount.atomic.multipliedBy(-1).toString(10)
        yourPortion = tranchedPool.sharePriceToUSDC(tx.juniorPrincipalDelta, backer.principalAmount)
      } else {
        assertUnreachable(tx)
      }
      return (
        <tr key={tx.txHash}>
          <td>{tx.name}</td>
          <td>{moment.unix(tx.timestamp).format("MMM D")}</td>
          <td className="numeric">
            {isMobile ? displayDollarsTruncated(usdcFromAtomic(amount)) : displayDollars(usdcFromAtomic(amount))}
          </td>
          <td className="numeric">
            {isMobile
              ? displayDollarsTruncated(usdcFromAtomic(yourPortion), true)
              : displayDollars(usdcFromAtomic(yourPortion))}
          </td>
          <td className="transaction-link">
            <a
              className="inline-button"
              href={`https://etherscan.io/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {iconOutArrow}
            </a>
          </td>
        </tr>
      )
    })
  }

  return (
    <div>
      <div className="background-container">
        <h2>Credit Status</h2>
        <div className="background-container-inner">
          <InfoSection rows={rows} />
        </div>
        <div className="background-container-inner recent-repayments">
          <div className="section-header">Recent transactions</div>
          <table className={"table"}>
            <thead>
              <tr>
                <th className="transaction-type">Transaction</th>
                <th className="transaction-date">Date</th>
                <th className="transaction-amount numeric">Amount</th>
                <th className="transaction-portion numeric">Your Portion</th>
                <th className="transaction-link"> </th>
              </tr>
            </thead>
            <tbody>{transactionRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
