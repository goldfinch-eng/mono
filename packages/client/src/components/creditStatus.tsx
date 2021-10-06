import React from "react"
import InfoSection from "./infoSection.js"
import CreditBarViz from "./creditBarViz.js"
import {usdcFromAtomic} from "../ethereum/erc20"
import {decimals} from "../ethereum/utils"
import {displayDollars, displayNumber} from "../utils"
import {iconClock} from "./icons.js"
// @ts-expect-error ts-migrate(2691) FIXME: An import path cannot end with a '.tsx' extension.... Remove this comment to see the full error message
import EtherscanLink from "./etherscanLink.tsx"

function CreditStatus(props) {
  function fromAtomicDecimals(val) {
    // @ts-expect-error ts-migrate(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
    return usdcFromAtomic(val) * decimals
  }

  let placeholderClass = ""
  if (!props.user.address || !props.user.usdcIsUnlocked("borrow") || props.creditLine.limit.eq(0)) {
    placeholderClass = "placeholder"
  }

  let rows
  if (props.creditLine.limit.eq(0)) {
    rows = [
      {label: "Limit", value: "$ -"},
      {label: "Interest rate APR", value: "- %"},
      {label: "Payment frequency", value: "-"},
      {label: "Payback term", value: "-"},
    ]
  } else {
    const limit = usdcFromAtomic(props.creditLine.limit)
    const interestRateAPR = props.creditLine.interestAprDecimal.multipliedBy(100)
    const paymentFrequency = fromAtomicDecimals(props.creditLine.paymentPeriodInDays)
    const paybackTerm = fromAtomicDecimals(props.creditLine.termInDays)

    rows = [
      {label: "Limit", value: "$" + displayNumber(limit, 2)},
      {label: "Interest rate APR", value: displayNumber(interestRateAPR, 2) + "%"},
      {label: "Payment frequency", value: paymentFrequency + " days"},
      {label: "Payback term", value: paybackTerm + " days"},
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
  let remainingTotalDue = props.creditLine.remainingTotalDueAmountInDollars
  let availableToDrawdown = props.creditLine.availableCreditInDollars

  const creditLineAddress = props.creditLine.address
  const tranchedPoolAddress = props.user.borrower?.tranchedPoolByCreditLine[creditLineAddress]?.address

  return (
    <div className={`credit-status background-container ${placeholderClass}`}>
      <div className="credit-status-header">
        <h2>Credit Status</h2>
        <EtherscanLink
          tranchedPoolAddress={tranchedPoolAddress}
          classNames={`pool-link ${placeholderClass !== "" && "disabled-link"}`}
        />
      </div>
      <div className="credit-status-balance background-container-inner">
        <CreditBarViz
          leftAmount={remainingTotalDue}
          leftAmountDisplay={displayDollars(remainingTotalDue)}
          leftAmountDescription={"Balance plus interest"}
          rightAmount={availableToDrawdown}
          rightAmountDisplay={displayDollars(availableToDrawdown)}
          rightAmountDescription={"Available to drawdown"}
        />
        {termDueDate}
      </div>
      {/* @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call. */}
      <InfoSection rows={rows} />
    </div>
  )
}

export default CreditStatus
