import React, { useState, useContext } from "react"
import DepositForm from "./depositForm.js"
import DepositStatus from "./depositStatus.js"
import { AppContext } from "../App"
import WithdrawalForm from "./withdrawalForm.js"
import { iconUpArrow, iconDownArrow } from "./icons.js"

function EarnActionsContainer(props) {
  const { user, creditDesk } = useContext(AppContext)
  const [showAction, setShowAction] = useState(null)

  function closeForm(e) {
    setShowAction(null)
  }

  const actionComplete = function() {
    props.actionComplete().then(() => {
      closeForm()
    })
  }

  let placeholderClass = ""
  if (!user.address || !user.usdcIsUnlocked("earn") || !user.goListed) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  if (user.usdcIsUnlocked("earn") && user.goListed && props.capitalProvider) {
    depositAction = e => {
      setShowAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (user.usdcIsUnlocked("earn") && props.capitalProvider.availableToWithdrawal > 0) {
    withdrawAction = e => {
      setShowAction("withdrawal")
    }
    withdrawClass = ""
  }

  if (showAction === "deposit") {
    return (
      <DepositForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={actionComplete}
      />
    )
  } else if (showAction === "withdrawal") {
    return (
      <WithdrawalForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData}
        actionComplete={actionComplete}
      />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus capitalProvider={props.capitalProvider} creditDesk={creditDesk} poolData={props.poolData} />
        <div className="form-start">
          <button className={`button ${depositClass}`} onClick={depositAction}>
            {iconUpArrow} Deposit
          </button>
          <button className={`button ${withdrawClass}`} onClick={withdrawAction}>
            {iconDownArrow} Withdraw
          </button>
        </div>
      </div>
    )
  }
}

export default EarnActionsContainer
