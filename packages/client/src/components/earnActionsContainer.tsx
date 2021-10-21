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
import {SeniorPoolData, UserData} from "../graphql/helpers"

interface EarnActionsContainerProps {
  actionComplete: () => Promise<any>
  capitalProvider?: CapitalProvider | UserData
  poolData?: PoolData | SeniorPoolData
  kyc?: KYC
}

function EarnActionsContainer(props: EarnActionsContainerProps) {
  const {kyc, poolData, capitalProvider} = props
  const {user, goldfinchConfig} = useContext(AppContext)
  const [showAction, setShowAction] = useState<string>()
  const remainingCapacity = poolData?.remainingCapacity(goldfinchConfig.totalFundsLimit) || new BigNumber("0")

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

  if (user.usdcIsUnlocked("earn") && eligibleForSeniorPool(kyc, user) && capitalProvider && remainingCapacity.gt("0")) {
    depositAction = (e) => {
      setShowAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (user.usdcIsUnlocked("earn") && eligibleForSeniorPool(kyc, user) && capitalProvider?.availableToWithdraw.gt(0)) {
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
        capitalProvider={capitalProvider}
        poolData={poolData!}
        actionComplete={actionComplete}
      />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus capitalProvider={capitalProvider} poolData={poolData} />
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
