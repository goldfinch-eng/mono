import {useContext, useState} from "react"
import {AppContext} from "../App"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {KYC} from "../hooks/useGoldfinchClient"
import {eligibleForSeniorPool} from "../hooks/useKYC"
import {assertNonNullable} from "../utils"
import DepositForm from "./depositForm"
import DepositStatus from "./depositStatus"
import {iconDownArrow, iconUpArrow} from "./icons"
import WithdrawalForm from "./withdrawalForm"

interface EarnActionsContainerProps {
  actionComplete: () => Promise<any>
  capitalProvider: CapitalProvider | undefined
  poolData: PoolData | undefined
  kyc: KYC | undefined
}

function EarnActionsContainer(props: EarnActionsContainerProps) {
  const {kyc} = props
  const {user, goldfinchConfig} = useContext(AppContext)
  const [showAction, setShowAction] = useState<string>()

  function closeForm() {
    setShowAction("")
  }

  const actionComplete = function () {
    props.actionComplete().then(() => {
      closeForm()
    })
  }

  const readyAndEligible =
    !!user.address && !!props.poolData && !!props.capitalProvider && eligibleForSeniorPool(kyc, user)

  let placeholderClass = ""
  if (!readyAndEligible) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  if (
    readyAndEligible &&
    goldfinchConfig &&
    props.poolData?.remainingCapacity(goldfinchConfig.totalFundsLimit).gt("0")
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
    assertNonNullable(props.poolData)
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
