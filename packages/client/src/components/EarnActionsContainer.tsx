import {useContext, useState} from "react"
import {AppContext} from "../App"
import {CapitalProvider} from "../ethereum/pool"
import {useFromSameBlock} from "../hooks/useFromSameBlock"
import {assertNonNullable} from "../utils"
import DepositForm from "./depositForm"
import DepositStatus from "./depositStatus"
import {iconDownArrow, iconUpArrow} from "./icons"
import {eligibleForSeniorPool} from "./SeniorPool/utils"
import WithdrawalForm from "./withdrawalForm"

interface EarnActionsContainerProps {
  disabled: boolean
  actionComplete: () => Promise<any>
  capitalProvider: CapitalProvider | undefined
}

function EarnActionsContainer(props: EarnActionsContainerProps) {
  const {disabled} = props
  const {pool: _pool, user: _user, goldfinchConfig, currentBlock} = useContext(AppContext)
  const [showAction, setShowAction] = useState<string>()
  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _pool, _user)

  function closeForm() {
    setShowAction("")
  }

  const actionComplete = function () {
    props.actionComplete().then(() => {
      closeForm()
    })
  }

  let readyAndEligible = false
  if (consistent) {
    // TODO NEED TO FIX
    const [pool, user] = consistent
    readyAndEligible =
      !disabled && !!user && !!pool.info.value.poolData && !!props.capitalProvider && eligibleForSeniorPool(user)
  }

  let placeholderClass = ""
  if (!readyAndEligible) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  if (
    readyAndEligible &&
    goldfinchConfig &&
    consistent?.[0].info.value.poolData.remainingCapacity(goldfinchConfig.totalFundsLimit).gt("0")
  ) {
    depositAction = (e) => {
      setShowAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (readyAndEligible && props.capitalProvider?.availableToWithdraw.gt(0)) {
    withdrawAction = (e) => {
      setShowAction("withdrawal")
    }
    withdrawClass = ""
  }

  if (showAction === "deposit") {
    return <DepositForm closeForm={closeForm} actionComplete={actionComplete} />
  } else if (showAction === "withdrawal") {
    assertNonNullable(props.capitalProvider)
    assertNonNullable(consistent)
    const pool = consistent[0]
    return (
      <WithdrawalForm
        closeForm={closeForm}
        capitalProvider={props.capitalProvider}
        poolData={pool.info.value.poolData}
        actionComplete={actionComplete}
      />
    )
  } else {
    const poolData = consistent?.[0].info.value.poolData
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus capitalProvider={props.capitalProvider} poolData={poolData} />
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
