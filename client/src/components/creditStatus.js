import React from "react"
import InfoSection from "./infoSection.js"
import CreditBarViz from "./creditBarViz.js"
import { usdcFromAtomic } from "../ethereum/erc20"
import { decimals } from "../ethereum/utils"
import { displayNumber } from "../utils"
import { iconClock } from "./icons.js"

function CreditStatus(props) {
  function fromAtomicDecimals(val) {
    return usdcFromAtomic(val) * decimals
  }

  let placeholderClass = ""
  if (!props.user.address || !props.user.usdcIsUnlocked("borrow") || props.creditLine.limit.eq(0)) {
    placeholderClass = "placeholder"
  }

  let rows
  if (props.creditLine.limit.eq(0)) {
    rows = [
      { label: "Limit", value: "$ -" },
      { label: "Interest rate APR", value: "- %" },
      { label: "Payment frequency", value: "-" },
      { label: "Payback term", value: "-" },
    ]
  } else {
    const limit = usdcFromAtomic(props.creditLine.limit)
    const interestRateAPR = props.creditLine.interestAprDecimal.multipliedBy(100)
    const paymentFrequency = fromAtomicDecimals(props.creditLine.paymentPeriodInDays)
    const paybackTerm = fromAtomicDecimals(props.creditLine.termInDays)

    rows = [
      { label: "Limit", value: "$" + displayNumber(limit, 2) },
      { label: "Interest rate APR", value: displayNumber(interestRateAPR, 2) + "%" },
      { label: "Payment frequency", value: paymentFrequency + " days" },
      { label: "Payback term", value: paybackTerm + " days" },
    ]
  }

  let termDueDate
  if (props.creditLine.remainingTotalDueAmount.gt(0)) {
    termDueDate = (
      <div className="term-due-date">
        {iconClock}Full balance repayment due {props.creditLine.termEndDate}
      </div>
    )
  }

  return (
    <div className={`credit-status background-container ${placeholderClass}`}>
      <h2>Credit Status</h2>
      <div className="credit-status-balance background-container-inner">
        <CreditBarViz creditLine={props.creditLine} />
        {termDueDate}
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

export default CreditStatus
