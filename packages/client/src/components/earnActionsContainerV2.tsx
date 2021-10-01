import {useState, useContext} from "react"
import DepositForm from "./depositForm"
import DepositStatus from "./depositStatusV2"
import {AppContext} from "../App"
import WithdrawalForm from "./withdrawalFormV2"
import {iconUpArrow, iconDownArrow} from "./icons"
import BigNumber from "bignumber.js"
import {KYC} from "../hooks/useGoldfinchClient"
import {eligibleForSeniorPool} from "../hooks/useKYC"
import {SeniorPool, User} from "../graphql/types"

interface EarnActionsContainerProps {
  actionComplete: () => Promise<any>
  capitalProvider: User
  poolData?: SeniorPool
  kyc?: KYC
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
  if (!user.address || !user.usdcIsUnlocked("earn") || !eligibleForSeniorPool(kyc)) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  let remainingCapacity =
    props.poolData?.lastestPoolStatus?.remainingCapacity(goldfinchConfig.totalFundsLimit) || new BigNumber("0")
  if (user.usdcIsUnlocked("earn") && eligibleForSeniorPool(kyc) && props.capitalProvider && remainingCapacity.gt("0")) {
    depositAction = (e) => {
      setShowAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (
    user.usdcIsUnlocked("earn") &&
    eligibleForSeniorPool(kyc) &&
    props.capitalProvider.capitalProviderStatus?.availableToWithdraw.gt(0)
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
