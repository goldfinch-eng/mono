import {useContext, useState} from "react"
import {useParams} from "react-router-dom"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {PoolState, TranchedPool, TRANCHES} from "../../ethereum/tranchedPool"
import {croppedAddress, displayDollars, displayPercent, roundDownPenny, roundUpPenny} from "../../utils"
import InfoSection from "../infoSection"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {iconDownArrow, iconOutArrow, iconUpArrow} from "../icons"
import useSendFromUser from "../../hooks/useSendFromUser"
import useNonNullContext from "../../hooks/useNonNullContext"
import TransactionInput from "../transactionInput"
import {BigNumber} from "bignumber.js"
import LoadingButton from "../loadingButton"
import TransactionForm from "../transactionForm"
import {useAsync} from "../../hooks/useAsync"
import useERC20Permit from "../../hooks/useERC20Permit"
import useCurrencyUnlocked from "../../hooks/useCurrencyUnlocked"
import UnlockERC20Form from "../unlockERC20Form"
import CreditBarViz from "../creditBarViz"
import {DepositMade} from "../../typechain/web3/TranchedPool"
import moment from "moment"
import {useBacker, useTranchedPool} from "../../hooks/useTranchedPool"
import {useSession} from "../../hooks/useSignIn"
import _ from "lodash"

function useRecentPoolTransactions({tranchedPool}: {tranchedPool?: TranchedPool}): Record<string, any>[] {
  let recentTransactions = useAsync(() => tranchedPool && tranchedPool.recentTransactions(), [tranchedPool])
  if (recentTransactions.status === "succeeded") {
    return recentTransactions.value
  }
  return []
}

function useUniqueJuniorSuppliers({tranchedPool}: {tranchedPool?: TranchedPool}) {
  let uniqueSuppliers = 0
  const {goldfinchProtocol} = useContext(AppContext)

  let depositsQuery = useAsync(async () => {
    if (!tranchedPool || !goldfinchProtocol) {
      return []
    }
    return await goldfinchProtocol.queryEvent<DepositMade>(tranchedPool.contract, "DepositMade", {
      tranche: TRANCHES.Junior.toString(),
    })
  }, [tranchedPool, goldfinchProtocol])

  if (depositsQuery.status === "succeeded") {
    uniqueSuppliers = new Set(depositsQuery.value.map((e) => e.returnValues.owner)).size
  }

  return uniqueSuppliers
}

interface TranchedPoolActionFormProps {
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}

function TranchedPoolDepositForm({tranchedPool, actionComplete, closeForm}: TranchedPoolActionFormProps) {
  const {user, goldfinchConfig, usdc} = useNonNullContext(AppContext)
  const {gatherPermitSignature} = useERC20Permit()
  const sendFromUser = useSendFromUser()

  async function action({transactionAmount}) {
    const depositAmount = usdcToAtomic(transactionAmount)
    // USDC permit doesn't work on mainnet forking due to mismatch between hardcoded chain id in the contract
    if (process.env.REACT_APP_HARDHAT_FORK) {
      return sendFromUser(tranchedPool.contract.methods.deposit(TRANCHES.Junior, depositAmount), {
        type: "Deposit",
        amount: depositAmount,
      }).then(actionComplete)
    } else {
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
  }

  function renderForm({formMethods}) {
    let warningMessage, disabled
    const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()

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
            maxAmount={remainingJuniorCapacity}
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

function TranchedPoolWithdrawForm({tranchedPool, actionComplete, closeForm}: TranchedPoolActionFormProps) {
  const {user, goldfinchConfig} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()
  const backer = useBacker({user, tranchedPool})

  async function action({transactionAmount}) {
    const withdrawAmount = usdcToAtomic(transactionAmount)
    return sendFromUser(tranchedPool.contract.methods.withdraw(backer!.tokenInfos[0]!.id, withdrawAmount), {
      type: "Withdraw",
      amount: withdrawAmount,
    }).then(actionComplete)
  }

  function renderForm({formMethods}) {
    return (
      <div className="form-inputs">
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={backer?.availableToWithdrawInDollars}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue("transactionAmount", roundDownPenny(backer?.availableToWithdrawInDollars), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              >
                Max
              </button>
            }
            validations={{
              wallet: (value) => user.usdcBalanceInDollars.gte(value) || "You do not have enough USDC",
              transactionLimit: (value) =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of $${usdcFromAtomic(goldfinchConfig.transactionLimit)}`,
            }}
          />
          <LoadingButton action={action} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(backer?.availableToWithdrawInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}

function DepositStatus({tranchedPool}: {tranchedPool?: TranchedPool}) {
  const {user} = useContext(AppContext)
  const backer = useBacker({user, tranchedPool})

  if (!tranchedPool || !backer) {
    return <></>
  }

  const leverageRatio = tranchedPool.estimatedLeverageRatio

  let estimatedAPY = tranchedPool.estimateJuniorAPY(leverageRatio)
  let rightStatusItem
  if (tranchedPool.creditLine.balance.isZero()) {
    // Not yet drawdown
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. APY</div>
        <div className="value">{displayPercent(estimatedAPY)}</div>
        <div className="sub-value">(awaiting drawdown)</div>
      </div>
    )
  } else {
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. Monthly Interest</div>
        <div className="value">
          {displayDollars(usdcFromAtomic(tranchedPool.estimateMonthlyInterest(estimatedAPY, backer.principalAtRisk)))}
        </div>
        <div className="sub-value">{displayPercent(estimatedAPY)} APY</div>
      </div>
    )
  }

  return (
    <div className="deposit-status background-container-inner">
      <div className="deposit-status-item">
        <div className="label">Your balance</div>
        <div className="value">{displayDollars(backer.balanceInDollars)}</div>
        <div className="sub-value">{displayDollars(backer.availableToWithdrawInDollars)} available</div>
      </div>
      {rightStatusItem}
    </div>
  )
}

function ActionsContainer({tranchedPool, onComplete}: {tranchedPool?: TranchedPool; onComplete: () => Promise<any>}) {
  const {user} = useContext(AppContext)
  const [action, setAction] = useState<"" | "deposit" | "withdraw">("")
  const backer = useBacker({user, tranchedPool})
  const session = useSession()

  function actionComplete() {
    onComplete().then(() => {
      closeForm()
    })
  }

  function closeForm() {
    setAction("")
  }

  let placeholderClass = ""
  if (session.status !== "authenticated" || !user.goListed) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositClass = "disabled"
  if (
    session.status === "authenticated" &&
    tranchedPool?.state === PoolState.Open &&
    tranchedPool?.remainingCapacity().gt(new BigNumber(0))
  ) {
    depositAction = (e) => {
      setAction("deposit")
    }
    depositClass = ""
  }

  let withdrawAction
  let withdrawClass = "disabled"
  if (session.status === "authenticated" && backer && !backer.availableToWithdrawInDollars.isZero()) {
    withdrawAction = (e) => {
      setAction("withdraw")
    }
    withdrawClass = ""
  }

  if (action === "deposit") {
    return (
      <TranchedPoolDepositForm tranchedPool={tranchedPool!} closeForm={closeForm} actionComplete={actionComplete} />
    )
  } else if (action === "withdraw") {
    return (
      <TranchedPoolWithdrawForm tranchedPool={tranchedPool!} closeForm={closeForm} actionComplete={actionComplete} />
    )
  } else {
    return (
      <div className={`background-container ${placeholderClass}`}>
        <DepositStatus tranchedPool={tranchedPool} />
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

function V1DealSupplyStatus({tranchedPool}: {tranchedPool?: TranchedPool}) {
  if (!tranchedPool) {
    return <></>
  }

  let juniorContribution = new BigNumber(tranchedPool.juniorTranche.principalDeposited)
  let remainingJuniorCapacity = tranchedPool.creditLine.limit.minus(juniorContribution)

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Senior Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(juniorContribution))),
    },
    {label: "Leverage Ratio", value: "N/A"},
    {
      label: "Total Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(juniorContribution))),
    },
  ]

  let rightAmountPrefix = ""
  let rightAmountDescription = "Remaining"
  if (tranchedPool.state === PoolState.Open) {
    // Show an "approx." sign if the junior tranche is not yet locked
    rightAmountPrefix = "~"
    rightAmountDescription = "Est. Remaining"
  }

  return (
    <div className="background-container">
      <h2>Capital Supply</h2>
      <div className="credit-status-balance background-container-inner">
        <CreditBarViz
          leftAmount={new BigNumber(usdcFromAtomic(juniorContribution))}
          leftAmountDisplay={displayDollars(usdcFromAtomic(juniorContribution))}
          leftAmountDescription={"From the Senior Pool"}
          rightAmount={new BigNumber(usdcFromAtomic(remainingJuniorCapacity))}
          rightAmountDisplay={`${rightAmountPrefix}${displayDollars(usdcFromAtomic(remainingJuniorCapacity))}`}
          rightAmountDescription={rightAmountDescription}
        />
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

function SupplyStatus({tranchedPool}: {tranchedPool?: TranchedPool}) {
  const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()
  const uniqueJuniorSuppliers = useUniqueJuniorSuppliers({tranchedPool})

  if (!tranchedPool) {
    return <></>
  }

  let juniorContribution = new BigNumber(tranchedPool?.juniorTranche.principalDeposited)
  let seniorContribution = new BigNumber(tranchedPool?.seniorTranche.principalDeposited).plus(
    tranchedPool.estimatedSeniorPoolContribution,
  )

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Senior Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(seniorContribution))),
    },
    {label: "Leverage Ratio", value: `${tranchedPool.estimatedLeverageRatio.toString()}x`},
    {
      label: "Total Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.estimatedTotalAssets()))),
    },
  ]

  let rightAmountPrefix = ""
  let rightAmountDescription = "Remaining"
  if (tranchedPool.state === PoolState.Open) {
    // Show an "approx." sign if the junior tranche is not yet locked
    rightAmountPrefix = "~"
    rightAmountDescription = "Est. Remaining"
  }

  return (
    <div className="background-container">
      <h2>Capital Supply</h2>
      <div className="credit-status-balance background-container-inner">
        <CreditBarViz
          leftAmount={new BigNumber(usdcFromAtomic(juniorContribution))}
          leftAmountDisplay={displayDollars(usdcFromAtomic(juniorContribution))}
          leftAmountDescription={
            uniqueJuniorSuppliers === 1
              ? `From ${uniqueJuniorSuppliers} Backer`
              : `From ${uniqueJuniorSuppliers} Backers`
          }
          rightAmount={new BigNumber(usdcFromAtomic(remainingJuniorCapacity))}
          rightAmountDisplay={`${rightAmountPrefix}${displayDollars(usdcFromAtomic(remainingJuniorCapacity))}`}
          rightAmountDescription={rightAmountDescription}
        />
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

function CreditStatus({tranchedPool}: {tranchedPool?: TranchedPool}) {
  const {user} = useContext(AppContext)
  const transactions = useRecentPoolTransactions({tranchedPool})
  const backer = useBacker({user, tranchedPool})

  // Don't show the credit status component until the pool has a drawdown
  if (!backer || !tranchedPool || (transactions.length === 0 && !tranchedPool.isMigrated)) {
    return <></>
  }
  let creditLine = tranchedPool.creditLine

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Principal Outstanding",
      value: displayDollars(usdcFromAtomic(creditLine.balance)),
    },
    {
      label: "Your principal portion",
      value: displayDollars(usdcFromAtomic(backer.principalAmount)),
    },
    {
      label: "Full repayment due",
      value: creditLine.termEndDate,
    },
  ]

  let transactionRows
  if (transactions.length === 0) {
    transactionRows = (
      <tr className="empty-row">
        <td>No transactions</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    )
  } else {
    transactionRows = transactions.map((tx) => {
      let yourPortion, amount
      if (tx.event === "PaymentApplied") {
        amount = tx.amount
        const interestPortion = tranchedPool.sharePriceToUSDC(tx.juniorInterestDelta, backer.principalAmount)
        const principalPortion = tranchedPool.sharePriceToUSDC(tx.juniorPrincipalDelta, backer.principalAmount)
        yourPortion = interestPortion.plus(principalPortion)
      } else if (tx.event === "DrawdownMade") {
        amount = tx.amount.multipliedBy(-1)
        yourPortion = tranchedPool.sharePriceToUSDC(tx.juniorPrincipalDelta, backer.principalAmount)
      }
      return (
        <tr key={tx.txHash}>
          <td>{tx.name}</td>
          <td>{moment.unix(tx.timestamp).format("MMM D")}</td>
          <td className="numeric">{displayDollars(usdcFromAtomic(amount))}</td>
          <td className="numeric">{displayDollars(usdcFromAtomic(yourPortion))}</td>
          <td className="transaction-link">
            <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">
              {iconOutArrow}
            </a>
          </td>
        </tr>
      )
    })
  }

  return (
    <div>
      <div className="background-container">
        <h2>Credit Status</h2>
        <div className="background-container-inner">
          <InfoSection rows={rows} />
        </div>
        <div className="background-container-inner recent-repayments">
          <div className="section-header">Recent transactions</div>
          <table className={"table"}>
            <thead>
              <tr>
                <th className="transaction-type">Transaction</th>
                <th className="transaction-date">Date</th>
                <th className="transaction-amount numeric">Amount</th>
                <th className="transaction-portion numeric">Your Portion</th>
                <th className="transaction-link"> </th>
              </tr>
            </thead>
            <tbody>{transactionRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Overview({tranchedPool}: {tranchedPool?: TranchedPool}) {
  const session = useSession()

  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    let backerAPY = tranchedPool.estimateJuniorAPY(tranchedPool.estimatedLeverageRatio)
    let backerBoost = backerAPY.minus(tranchedPool.creditLine.interestAprDecimal)
    rows = _.compact([
      {label: "Credit limit", value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.creditLine.limit)))},
      {label: "Base Borrower APR", value: displayPercent(tranchedPool.creditLine.interestAprDecimal)},
      !backerBoost.isZero() && {label: "Est. Backer APR boost", value: displayPercent(backerBoost)},
      {
        label: "Payment frequency",
        value:
          tranchedPool.creditLine.paymentPeriodInDays.toString() === "1"
            ? `${tranchedPool.creditLine.paymentPeriodInDays} day`
            : `${tranchedPool.creditLine.paymentPeriodInDays} days`,
      },
      {
        label: "Payback term",
        value:
          tranchedPool.creditLine.termInDays.toString() === "1"
            ? `${tranchedPool.creditLine.termInDays} day`
            : `${tranchedPool.creditLine.termInDays} days`,
      },
    ])
  }

  let detailsLink = <></>
  if (tranchedPool?.metadata?.detailsUrl) {
    if (session.status === "authenticated") {
      detailsLink = (
        <div className="pool-links">
          <a href={tranchedPool.metadata.detailsUrl} target="_blank" rel="noopener noreferrer">
            Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
          </a>
        </div>
      )
    } else {
      detailsLink = (
        <div className="placeholder">
          <div className="pool-links">
            <button disabled={true}>
              Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
            </button>
          </div>
        </div>
      )
    }
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        {detailsLink}
      </div>
      <p className="pool-description">{tranchedPool?.metadata?.description}</p>
      <InfoSection rows={rows} />
    </div>
  )
}

function TranchedPoolView() {
  let tranchedPool: TranchedPool | undefined
  const {poolAddress} = useParams()
  const {goldfinchProtocol, usdc, user} = useContext(AppContext)
  const [tranchedPoolResult, refreshTranchedPool] = useTranchedPool({address: poolAddress, goldfinchProtocol})

  if (tranchedPoolResult.status === "succeeded") {
    tranchedPool = tranchedPoolResult.value
  }

  const [unlocked, refreshUnlocked] = useCurrencyUnlocked(usdc, {
    owner: user.address,
    spender: tranchedPool?.address,
    minimum: null,
  })

  let unlockForm = <></>

  let earnMessage = "Loading..."
  if (tranchedPool) {
    earnMessage = `Earn Portfolio / ${tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}`
  }

  if (process.env.REACT_APP_HARDHAT_FORK && !unlocked) {
    unlockForm = (
      <UnlockERC20Form erc20={usdc} onUnlock={() => (refreshUnlocked as any)()} unlockAddress={tranchedPool?.address} />
    )
  }

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice requireUnlock={false} requireVerify={true} requireSignIn={true} />
      {unlockForm}
      <InvestorNotice />
      <ActionsContainer tranchedPool={tranchedPool} onComplete={async () => refreshTranchedPool()} />
      <CreditStatus tranchedPool={tranchedPool} />
      {tranchedPool?.isV1StyleDeal ? (
        <V1DealSupplyStatus tranchedPool={tranchedPool} />
      ) : (
        <SupplyStatus tranchedPool={tranchedPool} />
      )}
      <Overview tranchedPool={tranchedPool} />
    </div>
  )
}

export default TranchedPoolView
