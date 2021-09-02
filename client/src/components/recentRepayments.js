import _ from "lodash"
import React, {useEffect, useState, useContext} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {displayDollars, croppedAddress} from "../utils"
import {iconOutArrow} from "./icons.js"

function RecentRepayments() {
  const {pool, user, network, goldfinchProtocol} = useContext(AppContext)
  const [repayments, setRepayments] = useState([])
  let transactionRows

  useEffect(() => {
    if (pool && pool.gf && goldfinchProtocol) {
      pool.gf.getRepaymentEvents(goldfinchProtocol).then((repayments) => {
        setRepayments(_.slice(repayments, 0, 3))
      })
    }
  }, [pool, goldfinchProtocol])

  function createTransactionRows(tx) {
    const etherscanSubdomain = network.name === "mainnet" ? "" : `${network.name}.`
    let yourPortion
    let yourPortionClass

    if (user.loaded && pool && pool.gf.loaded) {
      let yourPortionValue = usdcFromAtomic(
        user
          .poolBalanceAsOf(tx.blockTime)
          .dividedBy(pool.gf.assetsAsOf(tx.blockNumber))
          .multipliedBy(tx.interestAmountBN),
      )

      yourPortion = displayDollars(yourPortionValue, 4)
      yourPortionClass = yourPortionValue > 0 ? "" : "zero"
    } else {
      yourPortion = "Loading..."
    }
    return (
      <tr key={tx.eventId} className={"transaction-row"}>
        <td className="transaction-date">{tx.date}</td>
        <td className="transaction-link">
          <span className="transaction-link-label">{croppedAddress(tx.id)}</span>
          <a href={`https://${etherscanSubdomain}etherscan.io/tx/${tx.id}`} target="_blank" rel="noopener noreferrer">
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
