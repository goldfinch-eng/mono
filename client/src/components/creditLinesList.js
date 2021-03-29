import React from "react"
import { displayDollars, displayPercent } from "../utils"
import { iconCircleCheck } from "./icons.js"
import { usdcFromAtomic } from "../ethereum/erc20"

function CreditLinesList(props) {
  function creditLineRow(cl) {
    let icon

    let description = `${displayDollars(usdcFromAtomic(cl.limit))} at ${displayPercent(cl.interestAprDecimal)}`
    let nextPaymentDue = "No payment due"
    if (cl.isPaymentDue) {
      nextPaymentDue = `${displayDollars(cl.remainingPeriodDueAmountInDollars)} due ${cl.dueDate}`
    } else if (cl.isActive) {
      icon = iconCircleCheck
      nextPaymentDue = `Paid through ${cl.dueDate}`
    }

    return (
      <tr key={cl.name}>
        <td className="credit-line">
          {description}
          <span className="credit-line-id">{cl.name}</span>
        </td>
        <td className="payment">
          {icon}
          {nextPaymentDue}
        </td>
        <td className="view">
          <button className="view-credit-line" onClick={() => props.changeCreditLine(cl.address)}>
            View
          </button>
        </td>
      </tr>
    )
  }

  let creditLineRows = props.creditLine.creditLines.map(creditLineRow)

  return (
    <div className="background-container">
      <table className="table credit-lines-list">
        <thead>
          <tr>
            <th className="credit-line">Credit Line</th>
            <th className="payment">Next Payment</th>
            <th className="view" />
          </tr>
        </thead>
        <tbody>{creditLineRows}</tbody>
      </table>
    </div>
  )
}

export default CreditLinesList
