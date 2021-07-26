import {useState, useContext, useEffect} from "react"
import {useParams} from "react-router-dom"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {Backer, PoolState, TranchedPool, TRANCHES} from "../../ethereum/tranchedPool"
import {croppedAddress, displayDollars, displayPercent, roundUpPenny} from "../../utils"
import InfoSection from "../infoSection"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {iconDownArrow, iconOutArrow, iconUpArrow} from "../icons"
import {User} from "../../ethereum/user"
import useSendFromUser from "../../hooks/useSendFromUser"
import useNonNullContext from "../../hooks/useNonNullContext"
import TransactionInput from "../transactionInput"
import {BigNumber} from "bignumber.js"
import LoadingButton from "../loadingButton"
import TransactionForm from "../transactionForm"
import {AsyncResult, RefreshFn, useAsync, useAsyncFn} from "../../hooks/useAsync"
import useERC20Permit from "../../hooks/useERC20Permit"

function useTranchedPool({
  goldfinchProtocol,
  address,
}: {
  goldfinchProtocol?: GoldfinchProtocol
  address: string
}): [AsyncResult<TranchedPool>, RefreshFn] {
  let [result, refresh] = useAsyncFn<TranchedPool>(() => {
    if (!goldfinchProtocol) {
      return
    }

    let tranchedPool = new TranchedPool(address, goldfinchProtocol)
    return tranchedPool.initialize().then(() => tranchedPool)
  }, [address, goldfinchProtocol])

  useEffect(() => {
    refresh()
  }, [refresh])

  return [result, refresh]
}

function useBacker({user, tranchedPool}: {user: User; tranchedPool?: TranchedPool}): AsyncResult<Backer> {
  const {goldfinchProtocol} = useContext(AppContext)

  return useAsync<Backer>(() => {
    if (!user.loaded || !tranchedPool || !goldfinchProtocol) {
      return
    }

    let backer = new Backer(user.address, tranchedPool, goldfinchProtocol)
    return backer.initialize().then(() => backer)
  }, [user, tranchedPool, goldfinchProtocol])
}

function useEstimatedSeniorPoolContribution({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let {pool} = useContext(AppContext)
  let estimatedContribution = useAsync(
    () => pool && tranchedPool && pool.contract.methods.estimateInvestment(tranchedPool.address).call(),
    [pool, tranchedPool],
  )

  if (estimatedContribution.status === "succeeded") {
    return new BigNumber(estimatedContribution.value)
  }

  return
}

function useEstimatedLeverageRatio({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let totalAssets = useEstimatedTotalPoolAssets({tranchedPool})
  let juniorContribution = tranchedPool?.juniorTranche.principalDeposited

  if (totalAssets && juniorContribution) {
    return totalAssets.minus(juniorContribution).dividedBy(juniorContribution)
  }

  return
}

function useEstimatedTotalPoolAssets({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let estimatedSeniorPoolContribution = useEstimatedSeniorPoolContribution({tranchedPool})
  let juniorContribution = tranchedPool?.juniorTranche.principalDeposited
  let seniorContribution = tranchedPool?.seniorTranche.principalDeposited

  if (estimatedSeniorPoolContribution && juniorContribution && seniorContribution) {
    return estimatedSeniorPoolContribution.plus(juniorContribution).plus(seniorContribution)
  }

  return
}

function useRemainingCapacity({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  let estimatedTotalPoolAssets = useEstimatedTotalPoolAssets({tranchedPool})
  let capacity

  if (estimatedTotalPoolAssets && tranchedPool) {
    capacity = tranchedPool.creditLine.limit.minus(estimatedTotalPoolAssets)
  }

  return capacity
}

function useRemainingJuniorCapacity({tranchedPool}: {tranchedPool?: TranchedPool}): BigNumber | undefined {
  const remainingCapacity = useRemainingCapacity({tranchedPool})
  const estimatedLeverageRatio = useEstimatedLeverageRatio({tranchedPool})

  if (remainingCapacity && estimatedLeverageRatio) {
    return remainingCapacity.dividedBy(estimatedLeverageRatio.plus(1))
  }

  return
}

interface TranchedPoolDepositFormProps {
  tranchedPool: TranchedPool
  remainingCapacity: BigNumber
  actionComplete: () => void
  closeForm: () => void
}

function TranchedPoolDepositForm({
  tranchedPool,
  actionComplete,
  remainingCapacity,
  closeForm,
}: TranchedPoolDepositFormProps) {
  const {user, goldfinchConfig, usdc} = useNonNullContext(AppContext)
  const {gatherPermitSignature} = useERC20Permit()
  const remainingJuniorCapacity = useRemainingJuniorCapacity({tranchedPool})
  const sendFromUser = useSendFromUser()

  async function action({transactionAmount}) {
    const depositAmount = usdcToAtomic(transactionAmount)
    let signatureData = await gatherPermitSignature({
      token: usdc,
      value: new BigNumber(depositAmount),
      spender: tranchedPool.address,
    })
    return sendFromUser(
      tranchedPool.contract.methods.depositWithPermit(
        TRANCHES.Junior,
        signatureData.value,
        signatureData.deadline,
        signatureData.v,
        signatureData.r,
        signatureData.s,
      ),
      {
        type: "Deposit",
        amount: signatureData.value,
      },
    ).then(actionComplete)
  }

  function renderForm({formMethods}) {
    let warningMessage, disabled
    if (user.usdcBalance.eq(0)) {
      disabled = true
      warningMessage = (
        <p className="form-message">
          You don't have any USDC to deposit. You'll need to first send USDC to your address to deposit.
        </p>
      )
    }

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            disabled={disabled}
            validations={{
              wallet: (value) => user.usdcBalanceInDollars.gte(value) || "You do not have enough USDC",
              transactionLimit: (value) =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of $${usdcFromAtomic(goldfinchConfig.transactionLimit)}`,
              totalFundsLimit: (value) => {
                return (
                  remainingJuniorCapacity?.gte(usdcToAtomic(value)) ||
                  `This deposit would put the pool over its limit. It can accept a max of $${usdcFromAtomic(
                    remainingJuniorCapacity,
                  )}.`
                )
              },
            }}
          />
          <LoadingButton action={action} disabled={disabled} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Deposit"
      headerMessage={`Available to deposit: ${displayDollars(user.usdcBalanceInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}

function ActionsContainer({tranchedPool, onComplete}: {tranchedPool?: TranchedPool; onComplete: () => Promise<any>}) {
  const {user} = useContext(AppContext)
  const backer = useBacker({user, tranchedPool})
  console.log(backer)
  const [action, setAction] = useState<"" | "deposit" | "withdraw">("")
  const remainingCapacity = useRemainingCapacity({tranchedPool: tranchedPool})

  function actionComplete() {
    onComplete().then(() => {
      closeForm()
    })
  }

  function closeForm() {
    setAction("")
  }

  let placeholderClass = ""
  if (!user.address || !user.goListed) {
    placeholderClass = "placeholder"
  }
  let depositAction
  let depositClass = "disabled"
  if (tranchedPool?.state === PoolState.Open && remainingCapacity?.gt(new BigNumber(0))) {
    depositAction = (e) => {
      setAction("deposit")
    }
    depositClass = ""
  }
  let withdrawAction
  let withdrawClass = "disabled"

  if (action === "deposit") {
    return (
      <TranchedPoolDepositForm
        tranchedPool={tranchedPool!}
        remainingCapacity={remainingCapacity!}
        closeForm={closeForm}
        actionComplete={actionComplete}
      />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
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

function Overview({tranchedPool}: {tranchedPool?: TranchedPool}) {
  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    rows = [
      {label: "Credit limit", value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.creditLine.limit)))},
      {label: "Interest rate APR", value: displayPercent(tranchedPool.creditLine.interestAprDecimal)},
      {label: "Payment frequency", value: `${tranchedPool.creditLine.paymentPeriodInDays} days`},
      {label: "Payback term", value: `${tranchedPool.creditLine.termInDays} days`},
    ]
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        {tranchedPool?.metadata?.detailsUrl && (
          <div className="pool-links">
            <a href={tranchedPool.metadata.detailsUrl} target="_blank" rel="noopener noreferrer">
              Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
            </a>
          </div>
        )}
      </div>
      <p className="pool-description">{tranchedPool?.metadata?.description}</p>
      <InfoSection rows={rows} />
    </div>
  )
}

function TranchedPoolView() {
  const {poolAddress} = useParams()
  const {goldfinchProtocol} = useContext(AppContext)
  const [tranchedPoolResult, refreshTranchedPool] = useTranchedPool({address: poolAddress, goldfinchProtocol})
  let tranchedPool: TranchedPool | undefined
  if (tranchedPoolResult.status === "succeeded") {
    tranchedPool = tranchedPoolResult.value
  }

  let earnMessage = "Loading..."
  if (tranchedPool) {
    earnMessage = `Earn Portfolio / ${tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}`
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <InvestorNotice />
        <div>{earnMessage}</div>
      </div>
      <ConnectionNotice requireUnlock={false} requireVerify={true} />
      <ActionsContainer tranchedPool={tranchedPool} onComplete={async () => refreshTranchedPool()} />
      <Overview tranchedPool={tranchedPool} />
    </div>
  )
}

export default TranchedPoolView
