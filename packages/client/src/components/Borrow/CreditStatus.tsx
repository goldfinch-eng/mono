import React from "react"
import {BorrowerInterface} from "../../ethereum/borrower"
import {CreditLine} from "../../ethereum/creditLine"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {UserLoaded} from "../../ethereum/user"
import {displayDollars, displayNumber} from "../../utils"
import CreditBarViz from "../creditBarViz"
import EtherscanLink from "../etherscanLink"
import {iconClock, iconOutArrow} from "../icons"
import InfoSection from "../infoSection"

type CreditStatusProps = {
  user: UserLoaded
  borrower: BorrowerInterface
  creditLine: CreditLine
  disabled: boolean
}

function CreditStatus(props: CreditStatusProps) {
  let placeholderClass = ""
  if (
    !props.user ||
    !props.user.info.value.usdcIsUnlocked.borrow.isUnlocked ||
    props.creditLine.limit.eq(0) ||
    props.disabled
  ) {
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
    const paymentFrequency = props.creditLine.paymentPeriodInDays.toString()
    const paybackTerm = props.creditLine.termInDays.toString()

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
  let availableToDrawdown = props.borrower.getAvailableToBorrowInDollarsForCreditLine(props.creditLine)

  const creditLineAddress = props.creditLine.address
  const tranchedPoolAddress = props.borrower.getPoolAddress(creditLineAddress)

  return (
    <div className={`credit-status background-container ${placeholderClass}`}>
      <div className="credit-status-header">
        <h2>Credit Status</h2>
        <EtherscanLink
          address={tranchedPoolAddress}
          txHash={undefined}
          classNames={`pool-link ${placeholderClass !== "" && "disabled-link"}`}
        >
          {iconOutArrow}
        </EtherscanLink>
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
