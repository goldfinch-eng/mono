import React, {useContext, useEffect, useState} from "react"
import _ from "lodash"
import ConnectionNotice from "./connectionNotice"
import {AppContext} from "../App"
import {BlockInfo, displayDollars} from "../utils"
import {MAX_UINT} from "../ethereum/utils"
import BigNumber from "bignumber.js"
import {iconCircleUpLg, iconCircleDownLg, iconCircleCheckLg, iconOutArrow} from "./icons"
import {mapEventsToTx} from "../ethereum/events"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {TranchedPool} from "../ethereum/tranchedPool"

function Transactions(props) {
  const {user, network, goldfinchProtocol, currentBlock} = useContext(AppContext)
  const [tranchedPoolTxs, setTranchedPoolTxs] = useState()

  async function loadTranchedPoolEvents(
    tranchedPools: {[address: string]: TranchedPool},
    goldfinchProtocol: GoldfinchProtocol,
    currentBlock: BlockInfo
  ) {
    const tranchedPoolsAddresses = Object.keys(tranchedPools)
    let combinedEvents = _.flatten(
      await Promise.all(
        tranchedPoolsAddresses.map((address) =>
          goldfinchProtocol.queryEvents(
            tranchedPools[address]!.contract,
            ["DepositMade", "WithdrawalMade", "PaymentApplied", "DrawdownMade"],
            undefined,
            currentBlock.number
          )
        )
      )
    )
    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '{ type: any; name: any; amount: ... Remove this comment to see the full error message
    setTranchedPoolTxs(await mapEventsToTx(combinedEvents))
  }

  useEffect(() => {
    if (!user || !user.borrower || !goldfinchProtocol || !currentBlock) {
      return
    }
    loadTranchedPoolEvents(user.borrower.tranchedPools, goldfinchProtocol, currentBlock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, goldfinchProtocol, currentBlock])

  function transactionRow(tx) {
    // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
    const etherscanSubdomain = network.name === "mainnet" ? "" : `${network.name}.`

    let typeLabel = tx.name
    let typeCssClass = ""
    let icon = iconCircleCheckLg
    let amountPrefix = ""
    let amount = displayDollars(tx.amount)

    if (["Supply", "Payment"].includes(tx.name)) {
      typeCssClass = "inflow"
      icon = iconCircleUpLg
      amountPrefix = "+"
    } else if (["Withdrawal", "Drawdown"].includes(tx.name)) {
      typeCssClass = "outflow"
      icon = iconCircleDownLg
      amountPrefix = "-"
    } else if (tx.name === "Approval") {
      typeLabel = `${tx.erc20 && tx.erc20.ticker} Approval`
      let txAmount = tx.amountBN.shiftedBy(tx.amountBN.decimalPlaces())
      let max = new BigNumber(MAX_UINT.toString())
      if (txAmount.isEqualTo(max)) {
        amount = "Maximum"
      }
    }

    let statusCssClass = ""
    let txDate = tx.date
    if (tx.status === "error") {
      statusCssClass = "error"
      typeLabel = typeLabel + " (failed)"
    } else if (tx.status === "pending") {
      statusCssClass = "pending"
      txDate = "Processing..."
      icon = (
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
      )
    }

    return (
      <tr key={tx.eventId} className={`transaction-row ${typeCssClass} ${statusCssClass}`}>
        <td className="transaction-type">
          {icon}
          {typeLabel}
        </td>
        <td className="numeric">
          {amountPrefix}
          {amount}
        </td>
        <td className="transaction-date">{txDate}</td>
        <td className="transaction-link">
          <a
            className="inline-button"
            href={`https://${etherscanSubdomain}etherscan.io/tx/${tx.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {iconOutArrow}
          </a>
        </td>
      </tr>
    )
  }

  // Only show txs from currentTxs that are not already in user.pastTxs
  let pendingTxs = _.differenceBy(props.currentTXs, user ? user.info.value.pastTxs : [], "id")
  let allTxs = _.reverse(
    _.sortBy(_.compact(_.concat(pendingTxs, user ? user.info.value.pastTxs : [], tranchedPoolTxs)), "blockNumber")
  )
  allTxs = _.uniqBy(allTxs, "eventId")
  let transactionRows = (
    <tr className="empty-row">
      <td>No transactions</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  )
  if (allTxs.length > 0) {
    // @ts-expect-error ts-migrate(2739) FIXME: Type 'Element[]' is missing the following properti... Remove this comment to see the full error message
    transactionRows = allTxs.map(transactionRow)
  }

  return (
    <div className="content-section">
      <div className="page-header">Transactions</div>
      <ConnectionNotice requireUnlock={false} />
      <table className={`table transactions-table ${user ? "" : "placeholder"}`}>
        <thead>
          <tr>
            <th>Type</th>
            <th className="numeric">Amount</th>
            <th className="transaction-date">Date</th>
            <th className="transaction-link"></th>
          </tr>
        </thead>
        <tbody>{transactionRows}</tbody>
      </table>
    </div>
  )
}

export default Transactions
