import React, {useState, useContext} from "react"
import PaymentForm from "./paymentForm"
import DrawdownForm from "./drawdownForm"
import {iconCircleCheck, iconUpArrow, iconDownArrow} from "./icons"
import {AppContext} from "../App"
import {displayDollars} from "../utils"
import {displayDueDate} from "../ethereum/creditLine"

function CreditActionsContainer(props) {
  const {user} = useContext(AppContext)
  const [showAction, setShowAction] = useState(null)
  const availableCredit = props.creditLine.availableCredit

  function openAction(e, action) {
    e.preventDefault()
    setShowAction(action)
  }

  function closeForm() {
    setShowAction(null)
  }

  function actionComplete() {
    props.actionComplete().then(() => {
      closeForm()
    })
  }

  let placeholderClass = ""
  if (!user || !user.info.value.usdcIsUnlocked.borrow.isUnlocked || !props.creditLine.address || props.disabled) {
    placeholderClass = "placeholder"
  }

  let drawdownAction
  let drawdownClass = "disabled"

  if (availableCredit.gt(0) && user && user.info.value.usdcIsUnlocked.borrow.isUnlocked && !props.disabled) {
    drawdownAction = (e) => {
      openAction(e, "drawdown")
    }
    drawdownClass = ""
  }

  let payAction
  let payClass = "disabled"
  if (props.creditLine.isActive && user && user.info.value.usdcIsUnlocked.borrow.isUnlocked) {
    payAction = (e) => {
      openAction(e, "payment")
    }
    payClass = ""
  }

  let nextDueDisplay = "No payment due"
  let nextDueIcon
  const nextDueValueDisplay = displayDollars(props.creditLine.remainingPeriodDueAmountInDollars)
  if (props.creditLine.isPaymentDue) {
    nextDueDisplay = `${nextDueValueDisplay} due ${displayDueDate(props.creditLine)}`
  } else if (props.creditLine.isActive) {
    nextDueIcon = iconCircleCheck
    nextDueDisplay = `Paid through ${props.creditLine.dueDate}`
  }

  if (showAction === "payment") {
    return (
      <PaymentForm
        closeForm={closeForm}
        actionComplete={actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
        title={`Next payment: ${nextDueValueDisplay} due ${displayDueDate(props.creditLine)}`}
      />
    )
  } else if (showAction === "drawdown") {
    return (
      <DrawdownForm
        closeForm={closeForm}
        actionComplete={actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
      />
    )
  } else {
    return (
      <div className={`form-start split background-container ${placeholderClass}`}>
        <div className="form-start-section">
          <div className="form-start-label">Available to borrow</div>
          <div className="form-start-value">{displayDollars(props.creditLine.availableCreditInDollars)}</div>
          <button className={`button ${drawdownClass}`} onClick={drawdownAction}>
            {iconDownArrow} Borrow
          </button>
        </div>
        <div className="form-start-section">
          <div className="form-start-label">Next payment</div>
          <div className="form-start-value">
            {nextDueIcon}
            {nextDueDisplay}
          </div>
          <button className={`button dark ${payClass}`} onClick={payAction}>
            {iconUpArrow} Pay
          </button>
        </div>
      </div>
    )
  }
}

export default CreditActionsContainer
