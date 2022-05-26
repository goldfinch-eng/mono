import BigNumber from "bignumber.js"
import {useContext, useState} from "react"
import {AppContext} from "../../App"
import {PoolState, TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {Loadable} from "../../types/loadable"
import {TranchedPoolsEstimatedApyFromGfi} from "../Earn/types"
import {iconDownArrow, iconUpArrow} from "../icons"
import {DepositStatus} from "./DepositStatus"
import {TranchedPoolDepositForm} from "./TranchedPoolDepositForm"
import {TranchedPoolWithdrawForm} from "./TranchedPoolWithdrawForm"

export function ActionsContainer({
  tranchedPool,
  onComplete,
  backer,
  tranchedPoolsEstimatedApyFromGfi,
}: {
  tranchedPool: TranchedPool | undefined
  onComplete: () => Promise<any>
  backer: TranchedPoolBacker | undefined
  tranchedPoolsEstimatedApyFromGfi: Loadable<TranchedPoolsEstimatedApyFromGfi>
}) {
  const {user, currentBlock} = useContext(AppContext)
  const [action, setAction] = useState<"" | "deposit" | "withdraw">("")

  function actionComplete() {
    onComplete().then(() => {
      closeForm()
    })
  }

  function closeForm() {
    setAction("")
  }

  let placeholderClass = ""
  if (!user || !user.info.value.goListed) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositDisabled = true
  if (
    backer &&
    !tranchedPool?.isPaused &&
    tranchedPool?.poolState === PoolState.Open &&
    !tranchedPool.isFull &&
    !tranchedPool.metadata?.disabled &&
    user?.info.value.goListed
  ) {
    depositAction = (e) => {
      setAction("deposit")
    }
    depositDisabled = false
  }

  const currentTimestamp = currentBlock?.timestamp
  const isCurrentTimeBeforePoolFundableAt =
    currentTimestamp && tranchedPool && new BigNumber(currentTimestamp) < tranchedPool.fundableAt

  if (tranchedPool && tranchedPool.creditLine.termEndTime.isZero() && isCurrentTimeBeforePoolFundableAt) {
    depositAction = () => {
      setAction("")
    }
    depositDisabled = true
  }

  // Check if user has any of the tranchedPool required UID's
  const uidTypeToBalance = user?.info.value.uidTypeToBalance || {}
  const hasRequiredUIDType: boolean = !!tranchedPool?.allowedUIDTypes.some((uidType) => !!uidTypeToBalance[uidType])

  let withdrawAction
  let withdrawDisabled = true
  if (
    backer &&
    !tranchedPool?.isPaused &&
    !backer.availableToWithdrawInDollars.isZero() &&
    !tranchedPool?.metadata?.disabled &&
    (user?.info.value.goListed || hasRequiredUIDType)
  ) {
    withdrawAction = (e) => {
      setAction("withdraw")
    }
    withdrawDisabled = false
  }

  if (action === "deposit") {
    return (
      <TranchedPoolDepositForm
        backer={backer!}
        tranchedPool={tranchedPool!}
        closeForm={closeForm}
        actionComplete={actionComplete}
      />
    )
  } else if (action === "withdraw") {
    return (
      <TranchedPoolWithdrawForm
        backer={backer!}
        tranchedPool={tranchedPool!}
        closeForm={closeForm}
        actionComplete={actionComplete}
      />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus
          backer={backer}
          tranchedPool={tranchedPool}
          tranchedPoolsEstimatedApyFromGfi={tranchedPoolsEstimatedApyFromGfi}
        />
        <div className="form-start">
          <button
            className={`button ${depositDisabled ? "disabled" : ""}`}
            disabled={depositDisabled}
            onClick={depositAction}
          >
            {iconUpArrow} Supply
          </button>
          <button
            className={`button ${withdrawDisabled ? "disabled" : ""}`}
            disabled={withdrawDisabled}
            onClick={withdrawAction}
          >
            {iconDownArrow} Withdraw
          </button>
        </div>
      </div>
    )
  }
}
