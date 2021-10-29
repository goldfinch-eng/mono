import _ from "lodash"
import React, {useEffect, useState, useContext} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {displayDollars, croppedAddress, assertNonNullable} from "../utils"
import {iconOutArrow} from "./icons"

function RecentRepayments() {
  const {pool, user, network, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [repayments, setRepayments] = useState([])
  let transactionRows

  useEffect(() => {
    if (pool && goldfinchProtocol && currentBlock) {
      pool.info.value.poolData.getRepaymentEvents(pool, goldfinchProtocol, currentBlock).then((repayments) => {
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'any[]' is not assignable to para... Remove this comment to see the full error message
        setRepayments(_.slice(repayments, 0, 3))
      })
    }
  }, [pool, goldfinchProtocol, currentBlock])

  function createTransactionRows(tx) {
    assertNonNullable(network)
    const etherscanSubdomain = network.name === "mainnet" ? "" : `${network.name}.`
    let yourPortion
    let yourPortionClass

    if (user.loaded && pool) {
      let yourPortionValue = usdcFromAtomic(
        user
          .poolBalanceAsOf(tx.blockNumber)
          .dividedBy(pool.info.value.poolData.assetsAsOf(tx.blockNumber))
          .multipliedBy(tx.interestAmountBN)
      )

      yourPortion = displayDollars(yourPortionValue, 4)
      // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
      yourPortionClass = isFinite(yourPortionValue) && yourPortionValue > 0 ? "" : "zero"
    } else if (!user.loaded && !user.address) {
      yourPortion = displayDollars(0, 4)
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
            href={`https://${etherscanSubdomain}etherscan.io/tx/${tx.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {iconOutArrow}
          </a>
        </td>
        <td className="transaction-amount numeric">+{displayDollars(tx.amount)}</td>
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
