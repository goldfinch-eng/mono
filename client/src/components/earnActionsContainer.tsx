import React, { useState, useContext } from "react"
import DepositForm from "./depositForm"
import DepositStatus from "./depositStatus"
import { AppContext } from "../App"
import WithdrawalForm from "./withdrawalForm"
import { iconUpArrow, iconDownArrow } from "./icons"
import { CapitalProvider, PoolData } from "../ethereum/pool"

interface EarnActionsContainerProps {
  actionComplete: () => Promise<any>
  capitalProvider: CapitalProvider
  poolData?: PoolData
}

function EarnActionsContainer(props: EarnActionsContainerProps) {
  const { user } = useContext(AppContext)
  const [showAction, setShowAction] = useState<string>()

  function closeForm() {
    setShowAction("")
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
  if (user.usdcIsUnlocked("earn") && props.capitalProvider.availableToWithdraw.gt(0)) {
    withdrawAction = e => {
      setShowAction("withdrawal")
    }
    withdrawClass = ""
  }

  if (showAction === "deposit") {
    return <DepositForm closeForm={closeForm} actionComplete={actionComplete} />
  } else if (showAction === "withdrawal") {
    return (
      <WithdrawalForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={props.poolData!}
        actionComplete={actionComplete}
      />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus capitalProvider={props.capitalProvider} poolData={props.poolData} />
        <div className="form-start">
          <button className={`button ${depositClass}`} onClick={depositAction}>
            {iconUpArrow} Supply
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
