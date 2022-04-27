import React from "react"
import {CreditLine} from "../../ethereum/creditLine"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {displayDollars, displayPercent} from "../../utils"
import {iconCircleCheck} from "../icons"

type CreditLinesListProps = {
  creditLine: CreditLine
  disabled: boolean
  changeCreditLine: (clAddress: string) => void
}

function CreditLinesList(props: CreditLinesListProps) {
  function creditLineRow(cl) {
    let icon

    let description = `${displayDollars(usdcFromAtomic(cl.limit), 0)} at ${displayPercent(cl.interestAprDecimal, 1)}`
    let nextPaymentAmount = `${displayDollars(cl.remainingPeriodDueAmountInDollars)}`
    let nextPaymentDate = "N/A"
    if (cl.isLate) {
      nextPaymentDate = "Due now"
    } else if (cl.isPaymentDue) {
      nextPaymentDate = `${cl.dueDate}`
    } else if (cl.isActive) {
      icon = iconCircleCheck
      nextPaymentDate = "Paid"
    }

    const disabledClass = props.disabled ? "disabled" : ""

    return (
      <div className="table-row background-container-inner" key={cl.name}>
        <div className={`table-cell col40 ${disabledClass}`}>{description}</div>
        <div className={`table-cell col22 numeric ${disabledClass}`}>{nextPaymentAmount}</div>
        <div className={`table-cell col22 date ${disabledClass}`}>
          {icon}
          {nextPaymentDate}
        </div>
        <div className="table-cell col22">
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
