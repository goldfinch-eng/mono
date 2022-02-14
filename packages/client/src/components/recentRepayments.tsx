import {isString} from "@goldfinch-eng/utils/src/type"
import _ from "lodash"
import React, {useEffect, useState, useContext} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {CombinedRepaymentTx} from "../ethereum/pool"
import {getEtherscanSubdomain} from "../ethereum/utils"
import {displayDollars, croppedAddress, assertNonNullable, displayDollarsTruncated} from "../utils"
import {iconOutArrow} from "./icons"
import {populateDates} from "../ethereum/events"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "./styleConstants"

function RecentRepayments() {
  const {pool, user, network, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [repayments, setRepayments] = useState<CombinedRepaymentTx[]>([])
  const isMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenM})`})
  let transactionRows

  useEffect(() => {
    if (pool && goldfinchProtocol && currentBlock) {
      pool.info.value.poolData.getRepaymentEvents(pool, goldfinchProtocol, currentBlock).then((repayments) => {
        populateDates(_.slice(repayments, 0, 3)).then((richRepayments) => {
          setRepayments(richRepayments)
        })
      })
    }
  }, [pool, goldfinchProtocol, currentBlock])

  function createTransactionRows(tx: CombinedRepaymentTx) {
    assertNonNullable(network)
    const etherscanSubdomain = getEtherscanSubdomain(network)
    let yourPortion
    let yourPortionClass

    if (user && pool) {
      let yourPortionValue = usdcFromAtomic(
        user
          .poolBalanceAsOf(tx.blockNumber)
          .dividedBy(pool.info.value.poolData.assetsAsOf(tx.blockNumber))
          .multipliedBy(tx.interestAmountBN)
      )

      yourPortion = isMobile ? displayDollarsTruncated(yourPortionValue) : displayDollars(yourPortionValue, 4)
      // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
      yourPortionClass = isFinite(yourPortionValue) && yourPortionValue > 0 ? "" : "zero"
    } else if (!user) {
      yourPortion = isMobile ? displayDollars(0, 0) : displayDollars(0, 4)
    } else {
      yourPortion = "Loading..."
    }
    return (
      <tr key={tx.eventId} className={"transaction-row"}>
        <td className="transaction-date">{tx.date}</td>
        <td className="transaction-link">
          <span className="transaction-link-label">{croppedAddress(tx.id)}</span>
          <a
            className="inline-button"
            href={isString(etherscanSubdomain) ? `https://${etherscanSubdomain}etherscan.io/tx/${tx.id}` : ""}
            target="_blank"
            rel="noopener noreferrer"
          >
            {iconOutArrow}
          </a>
        </td>
        <td className="transaction-amount numeric">
          +{isMobile ? displayDollarsTruncated(tx.amount) : displayDollars(tx.amount)}
        </td>
        <td className={`transaction-portion numeric ${yourPortionClass}`}>+{yourPortion}</td>
      </tr>
    )
  }

  if (repayments.length === 0) {
    transactionRows = (
      <tr className="empty-row">
        <td>No transactions</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    )
  } else {
    transactionRows = repayments.map(createTransactionRows)
  }

  return (
    <div className="background-container-inner recent-repayments">
      <div className="section-header">Recent Borrower Repayments</div>
      <table className={"table recent-repayments-table"}>
        <thead>
          <tr>
            <th className="transaction-date">Date</th>
            <th className="transaction-link">TX</th>
            <th className="transaction-amount numeric">Amount</th>
            <th className="transaction-portion numeric">Your Portion</th>
          </tr>
        </thead>
        <tbody>{transactionRows}</tbody>
      </table>
    </div>
  )
}

export default RecentRepayments
