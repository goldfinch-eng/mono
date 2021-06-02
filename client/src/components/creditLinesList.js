import React from "react"
import { displayDollars, displayPercent } from "../utils"
import { iconCircleCheck } from "./icons.js"
import { usdcFromAtomic } from "../ethereum/erc20"

function CreditLinesList(props) {
  function creditLineRow(cl) {
    let icon

    let description = `${displayDollars(usdcFromAtomic(cl.limit), 0)} at ${displayPercent(cl.interestAprDecimal, 1)}`
    let nextPaymentAmount = `${displayDollars(cl.remainingPeriodDueAmountInDollars)}`
    let nextPaymentDate = "N/A"
    if (cl.isPaymentDue) {
      nextPaymentDate = `${cl.dueDate}`
    } else if (cl.isActive) {
      icon = iconCircleCheck
      nextPaymentDate = "Paid"
    }

    return (
      <div className="table-row background-container-inner" key={cl.name}>
        <div className="table-cell col40">{description}</div>
        <div className="table-cell col22 numeric">{nextPaymentAmount}</div>
        <div className="table-cell col22 date">
          {icon}
          {nextPaymentDate}
        </div>
        <div className="table-cell col16">
          <button className="view" onClick={() => props.changeCreditLine(cl.address)}>
            View
          </button>
        </div>
      </div>
    )
  }

  let creditLineRows = props.creditLine.creditLines.map(creditLineRow)

  return (
    <div className="table-spaced background-container credit-lines-list">
      <div className="table-header background-container-inner">
        <div className="table-cell col40">Credit Lines</div>
        <div className="table-cell col22 numeric">Next Payment</div>
        <div className="table-cell col22 date">Due Date</div>
        <div className="table-cell col16"></div>
      </div>
      {creditLineRows}
    </div>
  )
}

export default CreditLinesList
