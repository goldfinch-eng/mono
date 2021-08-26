import React, {useState, useContext} from "react"
import PaymentForm from "./paymentForm.js"
import DrawdownForm from "./drawdownForm.js"
import {iconCircleCheck, iconUpArrow, iconDownArrow} from "./icons.js"
import {AppContext} from "../App"
import {displayDollars} from "../utils"

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
  if (!user.address || !user.usdcIsUnlocked("borrow") || !props.creditLine.address) {
    placeholderClass = "placeholder"
  }

  let drawdownAction
  let drawdownClass = "disabled"

  if (availableCredit.gt(0) && user.usdcIsUnlocked("borrow")) {
    drawdownAction = (e) => {
      openAction(e, "drawdown")
    }
    drawdownClass = ""
  }

  let payAction
  let payClass = "disabled"
  if (props.creditLine.isActive && user.usdcIsUnlocked("borrow")) {
    payAction = (e) => {
      openAction(e, "payment")
    }
    payClass = ""
  }

  let nextDueDisplay = "No payment due"
  let nextDueIcon
  const nextDueValueDisplay = displayDollars(props.creditLine.remainingPeriodDueAmountInDollars)
  if (props.creditLine.isPaymentDue) {
    if (props.creditLine.isLate) {
      nextDueDisplay = `${nextDueValueDisplay} due now`
    } else {
      nextDueDisplay = `${nextDueValueDisplay} due ${props.creditLine.dueDate}`
    }
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
        title={`Next payment: ${nextDueValueDisplay} due ${props.creditLine.dueDate}`}
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
