import {BigNumber} from "bignumber.js"
import _ from "lodash"
import moment from "moment"
import {useContext, useEffect, useState} from "react"
import {useParams} from "react-router-dom"
import {AppContext, BackersByTranchedPoolAddress} from "../../App"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {DEPOSIT_MADE_EVENT} from "../../types/events"
import {PoolBacker, PoolState, TokenInfo, TranchedPool, TRANCHES} from "../../ethereum/tranchedPool"
import {SUPPLY_TX_TYPE, WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE} from "../../types/transactions"
import {decimalPlaces} from "../../ethereum/utils"
import {useAsync} from "../../hooks/useAsync"
import useCurrencyUnlocked from "../../hooks/useCurrencyUnlocked"
import useERC20Permit from "../../hooks/useERC20Permit"
import isUndefined from "lodash/isUndefined"
import compact from "lodash/compact"
import DefaultGoldfinchClient from "../../hooks/useGoldfinchClient"
import {useFetchNDA} from "../../hooks/useNDA"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {useSession} from "../../hooks/useSignIn"
import {useBacker, useTranchedPool} from "../../hooks/useTranchedPool"
import {
  assertError,
  assertNonNullable,
  BlockInfo,
  croppedAddress,
  displayDollars,
  displayPercent,
  roundDownPenny,
  roundUpPenny,
} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import CreditBarViz from "../creditBarViz"
import EtherscanLink from "../etherscanLink"
import {iconDownArrow, iconOutArrow, iconUpArrow} from "../icons"
import InfoSection from "../infoSection"
import InvestorNotice from "../investorNotice"
import LoadingButton from "../loadingButton"
import NdaPrompt from "../ndaPrompt"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"
import UnlockERC20Form from "../unlockERC20Form"

class MaxBackersError extends Error {}

function useRecentPoolTransactions({
  tranchedPool,
  currentBlock,
}: {
  tranchedPool?: TranchedPool
  currentBlock?: BlockInfo
}): Record<string, any>[] {
  let recentTransactions = useAsync(
    () => tranchedPool && currentBlock && tranchedPool.recentTransactions(currentBlock),
    [tranchedPool, currentBlock]
  )
  if (recentTransactions.status === "succeeded") {
    return recentTransactions.value
  }
  return []
}

function useUniqueJuniorSuppliers({tranchedPool}: {tranchedPool?: TranchedPool}) {
  let uniqueSuppliers = 0
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)

  let depositsQuery = useAsync(async () => {
    if (!tranchedPool || !goldfinchProtocol || !currentBlock) {
      return []
    }
    return await goldfinchProtocol.queryEvents(
      tranchedPool.contract,
      [DEPOSIT_MADE_EVENT],
      {
        tranche: TRANCHES.Junior.toString(),
      },
      currentBlock.number
    )
  }, [tranchedPool, goldfinchProtocol, currentBlock])

  if (depositsQuery.status === "succeeded") {
    uniqueSuppliers = new Set(depositsQuery.value.map((e) => e.returnValues.owner)).size
  }

  return uniqueSuppliers
}

interface TranchedPoolDepositFormProps {
  backer: PoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}

function TranchedPoolDepositForm({backer, tranchedPool, actionComplete, closeForm}: TranchedPoolDepositFormProps) {
  const {
    user,
    goldfinchConfig,
    usdc,
    network,
    networkMonitor,
    setSessionData,
    backersByTranchedPoolAddress,
    setBackersByTranchedPoolAddress,
  } = useNonNullContext(AppContext)
  const {gatherPermitSignature} = useERC20Permit()
  const sendFromUser = useSendFromUser()
  const session = useSession()

  async function enforceMaxBackers(): Promise<void> {
    const maxBackers = tranchedPool.maxBackers
    if (maxBackers) {
      // Refresh the list of unique backers, since it could have grown since the tranched
      // pool was loaded.
      return tranchedPool.getBackers().then((backers) => {
        setBackersByTranchedPoolAddress({
          ...backersByTranchedPoolAddress,
          [tranchedPool.address]: backers,
        })

        if (tranchedPool.getIsClosedToUser(user.address, backers)) {
          throw new MaxBackersError("Pool backers limit reached.")
        }
      })
    }
  }

  async function action({transactionAmount, fullName}) {
    try {
      if (session.status !== "authenticated") {
        throw new Error("Not signed in. Please refresh the page and try again")
      }
      const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
      const response = await client.signAgreement(user.address, fullName, tranchedPool.address)
      if (response.json.status !== "success") {
        throw new Error(response.json.error)
      }
    } catch (e: unknown) {
      assertError(e)

      // Although it's not really a transaction error, this feels cleaner and more consistent than showing a form error
      const txData = networkMonitor.addPendingTX({type: SUPPLY_TX_TYPE, data: {amount: transactionAmount}})
      networkMonitor.markTXErrored(txData, e)
      return
    }

    const depositAmount = usdcToAtomic(transactionAmount)
    // USDC permit doesn't work on mainnet forking due to mismatch between hardcoded chain id in the contract
    if (process.env.REACT_APP_HARDHAT_FORK) {
      return enforceMaxBackers()
        .then(() =>
          sendFromUser(tranchedPool.contract.methods.deposit(TRANCHES.Junior, depositAmount), {
            type: SUPPLY_TX_TYPE,
            data: {
              amount: transactionAmount,
            },
          })
        )
        .catch((err: unknown) => {
          if (err instanceof MaxBackersError) {
            console.log("Backers limit reached after initial loading but before sending transaction.")
          } else {
            throw err
          }
        })
        .then(actionComplete)
    } else {
      let signatureData = await gatherPermitSignature({
        token: usdc,
        value: new BigNumber(depositAmount),
        spender: tranchedPool.address,
      })
      return enforceMaxBackers()
        .then(() =>
          sendFromUser(
            tranchedPool.contract.methods.depositWithPermit(
              TRANCHES.Junior,
              signatureData.value,
              signatureData.deadline,
              signatureData.v,
              signatureData.r,
              signatureData.s
            ),
            {
              type: SUPPLY_TX_TYPE,
              data: {
                amount: transactionAmount,
              },
            }
          )
        )
        .catch((err: unknown) => {
          if (err instanceof MaxBackersError) {
            console.log("Backers limit reached after initial loading but before sending transaction.")
          } else {
            throw err
          }
        })
        .then(actionComplete)
    }
  }

  function renderForm({formMethods}) {
    const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()
    const backerLimitPercent = new BigNumber(
      tranchedPool.metadata?.backerLimit ?? process.env.REACT_APP_GLOBAL_BACKER_LIMIT ?? "1"
    )
    const backerLimit = tranchedPool.creditLine.limit.multipliedBy(backerLimitPercent)
    const maxTxAmount = BigNumber.min(
      backerLimit,
      remainingJuniorCapacity,
      user.info.value.usdcBalance,
      goldfinchConfig.transactionLimit
    )

    const disabled = user.info.value.usdcBalance.eq(0)
    const warningMessage = user.info.value.usdcBalance.eq(0) ? (
      <p className="form-message">
        You don't have any USDC to deposit. You'll need to first send USDC to your address to deposit.
      </p>
    ) : undefined

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="form-footer-message">
          By entering my name and clicking “I Agree” below, I hereby agree and acknowledge that (i) I am electronically
          signing and becoming a party to the{" "}
          <a className="form-link" href={tranchedPool?.metadata?.agreement} target="_blank" rel="noreferrer">
            Loan Agreement
          </a>{" "}
          for this pool, and (ii) my name and transaction information may be shared with the borrower.
        </div>
        <div className="form-input-container">
          <div className="form-input-label">Full legal name</div>
          <input
            type="text"
            name="fullName"
            placeholder="Name"
            className="form-input small-text"
            ref={formMethods.register({required: "Your full name is required"})}
          />
        </div>
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            disabled={disabled}
            maxAmount={maxTxAmount}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue(
                    "transactionAmount",
                    new BigNumber(usdcFromAtomic(maxTxAmount)).decimalPlaces(decimalPlaces, 1).toString(10),
                    {
                      shouldValidate: true,
                      shouldDirty: true,
                    }
                  )
                }}
              >
                Max
              </button>
            }
            validations={{
              wallet: (value) => user.info.value.usdcBalanceInDollars.gte(value) || "You do not have enough USDC",
              backerLimit: (value) => {
                const backerDeposits = backer.principalAmount.minus(backer.principalRedeemed).plus(usdcToAtomic(value))
                return (
                  backerDeposits.lte(backerLimit) ||
                  `This is over the per-backer limit for this pool of $${usdcFromAtomic(backerLimit)}`
                )
              },
              transactionLimit: (value) =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of ${displayDollars(
                  usdcFromAtomic(goldfinchConfig.transactionLimit),
                  0
                )}`,
              totalFundsLimit: (value) => {
                return (
                  remainingJuniorCapacity?.gte(usdcToAtomic(value)) ||
                  `This deposit would put the pool over its limit. It can accept a max of $${usdcFromAtomic(
                    remainingJuniorCapacity
                  )}.`
                )
              },
            }}
          />
          <LoadingButton action={action} disabled={disabled} text="I Agree" />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Supply"
      headerMessage={`Available to supply: ${displayDollars(user.info.value.usdcBalanceInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}

function splitWithdrawAmount(
  withdrawAmount: BigNumber,
  tokenInfos: TokenInfo[]
): {tokenIds: string[]; amounts: string[]} {
  let amountLeft = withdrawAmount
  let tokenIds: string[] = []
  let amounts: string[] = []

  tokenInfos.forEach((tokenInfo) => {
    if (amountLeft.isZero() || tokenInfo.principalRedeemable.plus(tokenInfo.interestRedeemable).isZero()) {
      return
    }

    let amountFromThisToken = BigNumber.min(
      amountLeft,
      tokenInfo.principalRedeemable.plus(tokenInfo.interestRedeemable)
    )
    amountLeft = amountLeft.minus(amountFromThisToken)
    tokenIds.push(tokenInfo.id)
    amounts.push(amountFromThisToken.toString())
  })

  return {tokenIds, amounts}
}

interface TranchedPoolWithdrawFormProps {
  backer: PoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}

function TranchedPoolWithdrawForm({backer, tranchedPool, actionComplete, closeForm}: TranchedPoolWithdrawFormProps) {
  const {goldfinchConfig} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()

  async function action({transactionAmount}) {
    const withdrawAmount = usdcToAtomic(transactionAmount)
    let firstToken = backer.tokenInfos[0]!
    if (new BigNumber(withdrawAmount).gt(firstToken.principalRedeemable.plus(firstToken.interestRedeemable))) {
      let splits = splitWithdrawAmount(new BigNumber(withdrawAmount), backer.tokenInfos)
      return sendFromUser(tranchedPool.contract.methods.withdrawMultiple(splits.tokenIds, splits.amounts), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      }).then(actionComplete)
    } else {
      return sendFromUser(tranchedPool.contract.methods.withdraw(backer.tokenInfos[0]!.id, withdrawAmount), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      }).then(actionComplete)
    }
  }

  function renderForm({formMethods}) {
    return (
      <div className="form-inputs">
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={backer.availableToWithdrawInDollars}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue("transactionAmount", roundDownPenny(backer.availableToWithdrawInDollars), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              >
                Max
              </button>
            }
            validations={{
              transactionLimit: (value) =>
                goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                `This is over the per-transaction limit of ${displayDollars(
                  usdcFromAtomic(goldfinchConfig.transactionLimit),
                  0
                )}`,
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
      headerMessage={`Available to withdraw: ${displayDollars(backer.availableToWithdrawInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}

function DepositStatus({tranchedPool, backer}: {tranchedPool?: TranchedPool; backer?: PoolBacker}) {
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
      </div>
    )
  } else {
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. Monthly Interest</div>
        {backer.balance.isZero() ? (
          <div className="value">{displayPercent(estimatedAPY)}</div>
        ) : (
          <>
            <div className="value">
              {displayDollars(
                usdcFromAtomic(tranchedPool.estimateMonthlyInterest(estimatedAPY, backer.principalAtRisk))
              )}
            </div>
            <div className="sub-value">{displayPercent(estimatedAPY)} APY</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="deposit-status background-container-inner">
      <div className="deposit-status-item">
        <div className="label">Your balance</div>
        <div className="value">{displayDollars(backer.balanceInDollars)}</div>
        {!backer.balance.isZero() && (
          <div className="sub-value">{displayDollars(backer.availableToWithdrawInDollars)} available</div>
        )}
      </div>
      {rightStatusItem}
    </div>
  )
}

function ActionsContainer({
  tranchedPool,
  onComplete,
  backer,
}: {
  tranchedPool: TranchedPool | undefined
  onComplete: () => Promise<any>
  backer: PoolBacker | undefined
}) {
  const {user, backersByTranchedPoolAddress} = useContext(AppContext)
  const [action, setAction] = useState<"" | "deposit" | "withdraw">("")
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
  if (session.status !== "authenticated" || !user || !user.info.value.goListed) {
    placeholderClass = "placeholder"
  }

  let depositAction
  let depositDisabled = true
  const isFull = tranchedPool?.getIsFull(user?.address, backersByTranchedPoolAddress?.[tranchedPool.address])
  if (
    session.status === "authenticated" &&
    backer &&
    !tranchedPool?.isPaused &&
    tranchedPool?.state === PoolState.Open &&
    !isUndefined(isFull) &&
    !isFull &&
    !tranchedPool?.metadata?.disabled &&
    user?.info.value.goListed
  ) {
    depositAction = (e) => {
      setAction("deposit")
    }
    depositDisabled = false
  }

  let withdrawAction
  let withdrawDisabled = true
  if (
    session.status === "authenticated" &&
    backer &&
    !tranchedPool?.isPaused &&
    !backer.availableToWithdrawInDollars.isZero() &&
    !tranchedPool?.metadata?.disabled &&
    user?.info.value.goListed
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
        <DepositStatus backer={backer} tranchedPool={tranchedPool} />
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
    tranchedPool.estimatedSeniorPoolContribution
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
          rightAmount={remainingJuniorCapacity ? new BigNumber(usdcFromAtomic(remainingJuniorCapacity)) : undefined}
          rightAmountDisplay={
            remainingJuniorCapacity
              ? `${rightAmountPrefix}${displayDollars(usdcFromAtomic(remainingJuniorCapacity))}`
              : undefined
          }
          rightAmountDescription={rightAmountDescription}
        />
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

function CreditStatus({tranchedPool}: {tranchedPool?: TranchedPool}) {
  const {user, currentBlock} = useContext(AppContext)
  const transactions = useRecentPoolTransactions({tranchedPool, currentBlock})
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
            <a
              className="inline-button"
              href={`https://etherscan.io/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
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

interface OverviewProps {
  tranchedPool?: TranchedPool
  handleDetails: () => void
}

function Overview({tranchedPool, handleDetails}: OverviewProps) {
  const {user} = useContext(AppContext)
  const session = useSession()

  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    let backerAPY = tranchedPool.estimateJuniorAPY(tranchedPool.estimatedLeverageRatio)
    let backerBoost = backerAPY.minus(tranchedPool.creditLine.interestAprDecimal)
    rows = compact([
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
  if (user && user.info.value.goListed && session.status === "authenticated" && tranchedPool?.metadata?.detailsUrl) {
    detailsLink = (
      <div className="pool-links">
        <button onClick={() => handleDetails()}>
          Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        {detailsLink}
      </div>
      <p className="pool-description">{tranchedPool?.metadata?.description}</p>
      <InfoSection rows={rows} />
      <div className="pool-links">
        <EtherscanLink address={tranchedPool?.address!}>
          Pool<span className="outbound-link">{iconOutArrow}</span>
        </EtherscanLink>
      </div>
    </div>
  )
}

interface TranchedPoolViewURLParams {
  poolAddress: string
}

function TranchedPoolView() {
  const {poolAddress} = useParams<TranchedPoolViewURLParams>()
  const {
    goldfinchProtocol,
    usdc,
    user,
    network,
    setSessionData,
    backersByTranchedPoolAddress,
    setBackersByTranchedPoolAddress,
    currentBlock,
  } = useContext(AppContext)
  const session = useSession()
  const [tranchedPool, refreshTranchedPool] = useTranchedPool({address: poolAddress, goldfinchProtocol, currentBlock})
  const [showModal, setShowModal] = useState(false)
  const backer = useBacker({user, tranchedPool})
  const [nda, refreshNDA] = useFetchNDA({user, tranchedPool})
  const hasSignedNDA = nda && nda?.status === "success"

  const [unlocked, refreshUnlocked] = useCurrencyUnlocked(usdc, {
    owner: user?.address,
    spender: tranchedPool?.address,
    minimum: null,
  })

  useEffect(() => {
    async function getAndSetBackers(
      tranchedPool: TranchedPool,
      backersByTranchedPoolAddress: BackersByTranchedPoolAddress,
      setBackersByTranchedPoolAddress: (newVal: BackersByTranchedPoolAddress) => void
    ) {
      const backers = await tranchedPool.getBackers()
      setBackersByTranchedPoolAddress({
        ...backersByTranchedPoolAddress,
        [tranchedPool.address]: backers,
      })
    }
    if (
      tranchedPool?.maxBackers &&
      backersByTranchedPoolAddress &&
      setBackersByTranchedPoolAddress &&
      !backersByTranchedPoolAddress[tranchedPool.address]
    ) {
      getAndSetBackers(tranchedPool, backersByTranchedPoolAddress, setBackersByTranchedPoolAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tranchedPool?.maxBackers])

  function openDetailsUrl() {
    window.open(tranchedPool?.metadata?.detailsUrl, "_blank")
  }

  const handleDetails = () => {
    if (!tranchedPool?.metadata?.NDAUrl || hasSignedNDA) {
      openDetailsUrl()
    } else {
      setShowModal(true)
    }
  }

  async function handleSignNDA() {
    assertNonNullable(user)
    assertNonNullable(network)
    assertNonNullable(setSessionData)
    if (session.status !== "authenticated") {
      return
    }
    const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
    return client
      .signNDA(user.address, tranchedPool!.address)
      .then((r) => {
        openDetailsUrl()
        setShowModal(false)
        refreshNDA()
      })
      .catch((error) => {
        setShowModal(false)
        console.error(error)
      })
  }

  const earnMessage = tranchedPool
    ? `Pools / ${tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}`
    : "Loading..."

  const unlockForm =
    tranchedPool && process.env.REACT_APP_HARDHAT_FORK && !unlocked ? (
      <UnlockERC20Form erc20={usdc} onUnlock={() => refreshUnlocked()} unlockAddress={tranchedPool.address} />
    ) : (
      <></>
    )

  const isAtMaxCapacity = tranchedPool?.remainingCapacity().isZero()
  const maxCapacityNotice = isAtMaxCapacity ? (
    <div className="info-banner background-container">
      <div className="message">
        <span>This borrower pool has reached its capital limit and is closed to additional capital.</span>
      </div>
    </div>
  ) : (
    <></>
  )

  const backers =
    tranchedPool && backersByTranchedPoolAddress ? backersByTranchedPoolAddress[tranchedPool.address] : undefined
  const isClosedToUser = tranchedPool && backers ? tranchedPool.getIsClosedToUser(user?.address, backers) : false

  const showActionsContainer = !isAtMaxCapacity || !backer?.balanceInDollars.isZero()

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice
        requireUnlock={false}
        requireGolist={true}
        isPaused={!!tranchedPool?.isPaused}
        isClosedToUser={isClosedToUser}
      />
      {unlockForm}
      {user && (
        <>
          {maxCapacityNotice}
          {showActionsContainer ? (
            <>
              <InvestorNotice />
              <ActionsContainer
                tranchedPool={tranchedPool}
                backer={backer}
                onComplete={async () => refreshTranchedPool()}
              />
            </>
          ) : undefined}
        </>
      )}
      <CreditStatus tranchedPool={tranchedPool} />
      {tranchedPool?.isV1StyleDeal ? (
        <V1DealSupplyStatus tranchedPool={tranchedPool} />
      ) : (
        <SupplyStatus tranchedPool={tranchedPool} />
      )}
      <Overview tranchedPool={tranchedPool} handleDetails={handleDetails} />
      <NdaPrompt
        show={showModal}
        onClose={() => setShowModal(false)}
        onSign={handleSignNDA}
        NDAUrl={tranchedPool?.metadata?.NDAUrl}
      />
    </div>
  )
}
export {TranchedPoolDepositForm}
export default TranchedPoolView
