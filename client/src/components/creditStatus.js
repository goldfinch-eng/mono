import React, {useContext} from "react"
import {AppContext} from "../App"
import InfoSection from "./infoSection.js"
import CreditBarViz from "./creditBarViz.js"
import {usdcFromAtomic} from "../ethereum/erc20"
import {decimals} from "../ethereum/utils"
import {displayDollars, displayNumber} from "../utils"
import {iconClock, iconOutArrow} from "./icons.js"

function CreditStatus(props) {
  const {network} = useContext(AppContext)
  const etherscanSubdomain = network.name === "mainnet" ? "" : `${network.name}.`

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
  const tranchedPoolLink = `https://${etherscanSubdomain}etherscan.io/address/${tranchedPoolAddress}`

  return (
    <div className={`credit-status background-container ${placeholderClass}`}>
      <div className="credit-status-header">
        <h2>Credit Status</h2>
        <a
          href={tranchedPoolLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`pool-link ${placeholderClass !== "" && "disabled-link"}`}
        >
          {iconOutArrow}
        </a>
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
      <InfoSection rows={rows} />
    </div>
  )
}

export default CreditStatus
