import React, {useState, useContext} from "react"
import PaymentForm from "./paymentForm"
import {iconUpArrow} from "./icons"
import {AppContext} from "../App"
import {displayDollars} from "../utils"

function CreditActionsMultipleContainer(props) {
  const {user} = useContext(AppContext)
  const [showAction, setShowAction] = useState(null)

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

  let payAction
  let payClass = "disabled"
  if (props.creditLine.remainingTotalDueAmount.gt(0) && user && user.info.value.usdcIsUnlocked.borrow.isUnlocked) {
    payAction = (e) => {
      openAction(e, "payment")
    }
    payClass = ""
  }

  let nextDueDisplay = "No payments due"
  let paymentsDue = 0
  const amountDue = displayDollars(props.creditLine.remainingPeriodDueAmountInDollars)
  props.creditLine.creditLines.forEach((cl) => {
    if (cl.isPaymentDue) {
      paymentsDue += 1
    }
  })
  if (props.creditLine.remainingPeriodDueAmount.gt(0)) {
    const {dueDate} = props.creditLine
    nextDueDisplay = `${amountDue} total ${dueDate && `due ${dueDate}`}`
  }
  let paymentsDueDisplay = "Upcoming Payments"
  if (paymentsDue === 1) {
    paymentsDueDisplay = "1 Upcoming Payment"
  } else if (paymentsDue > 1) {
    paymentsDueDisplay = `${paymentsDue} Upcoming Payments`
  }

  if (showAction === "payment") {
    return (
      <PaymentForm
        closeForm={closeForm}
        actionComplete={actionComplete}
        borrower={props.borrower}
        creditLine={props.creditLine}
        title={paymentsDue > 0 ? `${amountDue} total due for ${paymentsDue} payments` : nextDueDisplay}
      />
    )
  } else {
    return (
      <div className={`form-start single-option background-container ${placeholderClass}`}>
        <div className="description">
          <div className="form-start-section">
            <div className="form-start-label">{paymentsDueDisplay}</div>
          </div>
          <div className="form-start-section">
            <div className="form-start-value">{nextDueDisplay}</div>
          </div>
        </div>
        <div>
          <button className={`button dark ${payClass}`} onClick={payAction}>
            {iconUpArrow} Pay All
          </button>
        </div>
      </div>
    )
  }
}

export default CreditActionsMultipleContainer
