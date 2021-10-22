import {useState, useContext} from "react"
import DepositForm from "./depositForm"
import DepositStatus from "./depositStatus"
import {AppContext} from "../App"
import WithdrawalForm from "./withdrawalForm"
import {iconUpArrow, iconDownArrow} from "./icons"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import BigNumber from "bignumber.js"
import {KYC} from "../hooks/useGoldfinchClient"
import {eligibleForSeniorPool} from "../hooks/useKYC"

interface EarnActionsContainerProps {
  actionComplete: () => Promise<any>
  capitalProvider: CapitalProvider
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

  let placeholderClass = ""
  if (!user.address || !user.usdcIsUnlocked("earn") || !eligibleForSeniorPool(kyc, user)) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  let remainingCapacity = props.poolData?.remainingCapacity(goldfinchConfig.totalFundsLimit) || new BigNumber("0")
  if (
    user.usdcIsUnlocked("earn") &&
    eligibleForSeniorPool(kyc, user) &&
    props.capitalProvider &&
    remainingCapacity.gt("0")
  ) {
    depositAction = (e) => {
      setShowAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (
    user.usdcIsUnlocked("earn") &&
    eligibleForSeniorPool(kyc, user) &&
    props.capitalProvider.availableToWithdraw.gt(0)
  ) {
    withdrawAction = (e) => {
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
