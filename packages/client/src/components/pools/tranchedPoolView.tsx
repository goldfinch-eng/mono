import {BigNumber} from "bignumber.js"
import compact from "lodash/compact"
import moment from "moment"
import {useContext, useEffect, useState} from "react"
import {useParams} from "react-router-dom"
import {AppContext} from "../../App"
import {useEarn} from "../../contexts/EarnContext"
import {BackerRewardsLoaded} from "../../ethereum/backerRewards"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {SeniorPoolLoaded} from "../../ethereum/pool"
import {PoolState, TokenInfo, TranchedPool, TranchedPoolBacker, TRANCHES} from "../../ethereum/tranchedPool"
import {decimalPlaces} from "../../ethereum/utils"
import {useAsync} from "../../hooks/useAsync"
import useERC20Permit from "../../hooks/useERC20Permit"
import DefaultGoldfinchClient from "../../hooks/useGoldfinchClient"
import {useFetchNDA} from "../../hooks/useNDA"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {useSession} from "../../hooks/useSignIn"
import {useBacker, useTranchedPool} from "../../hooks/useTranchedPool"
import {DEPOSIT_MADE_EVENT} from "../../types/events"
import {Loadable, Loaded} from "../../types/loadable"
import {SUPPLY_TX_TYPE, WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE} from "../../types/transactions"
import {InfoIcon} from "../../ui/icons"
import {
  assertError,
  assertNonNullable,
  BlockInfo,
  croppedAddress,
  displayAbbreviated,
  displayDollars,
  displayPercent,
  roundDownPenny,
  roundUpPenny,
  sameBlock,
} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import CreditBarViz from "../creditBarViz"
import {TranchedPoolsEstimatedApyFromGfi} from "../Earn/types"
import EtherscanLink from "../etherscanLink"
import {iconDownArrow, iconInfo, iconOutArrow, iconUpArrow} from "../icons"
import InfoSection from "../infoSection"
import InvestorNotice from "../investorNotice"
import LoadingButton from "../loadingButton"
import NdaPrompt from "../ndaPrompt"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"
import EarnTooltipContent from "../Earn/EarnTooltipContent"
import {WIDTH_TYPES} from "../styleConstants"
import {useMediaQuery} from "react-responsive"

function useRecentPoolTransactions({
  tranchedPool,
  currentBlock,
}: {
  tranchedPool: TranchedPool | undefined
  currentBlock: BlockInfo | undefined
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

function useUniqueJuniorSuppliers({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  let uniqueSuppliers = 0
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)

  let depositsQuery = useAsync(async () => {
    if (!tranchedPool || !goldfinchProtocol || !currentBlock) {
      return []
    }
    return await goldfinchProtocol.queryEvents(
      tranchedPool.contract.readOnly,
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
  backer: TranchedPoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}

function TranchedPoolDepositForm({backer, tranchedPool, actionComplete, closeForm}: TranchedPoolDepositFormProps) {
  const {user, goldfinchConfig, usdc, network, networkMonitor, setSessionData} = useNonNullContext(AppContext)
  const {gatherPermitSignature} = useERC20Permit()
  const sendFromUser = useSendFromUser()
  const session = useSession()

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
    let signatureData = await gatherPermitSignature({
      token: usdc,
      value: new BigNumber(depositAmount),
      spender: tranchedPool.address,
    })
    return sendFromUser(
      tranchedPool.contract.userWallet.methods.depositWithPermit(
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
    ).then(actionComplete)
  }

  function renderForm({formMethods}) {
    const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()
    const backerLimitPercent = new BigNumber(
      tranchedPool.metadata?.backerLimit ?? process.env.REACT_APP_GLOBAL_BACKER_LIMIT ?? "1"
    )
    const backerLimit = tranchedPool.creditLine.limit.multipliedBy(backerLimitPercent)
    const maxTxAmountInDollars = usdcFromAtomic(
      BigNumber.min(backerLimit, remainingJuniorCapacity, user.info.value.usdcBalance, goldfinchConfig.transactionLimit)
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
            maxAmountInDollars={maxTxAmountInDollars}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue(
                    "transactionAmount",
                    new BigNumber(maxTxAmountInDollars).decimalPlaces(decimalPlaces, 1).toString(10),
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
  backer: TranchedPoolBacker
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
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdrawMultiple(splits.tokenIds, splits.amounts), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      }).then(actionComplete)
    } else {
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdraw(backer.tokenInfos[0]!.id, withdrawAmount), {
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
            maxAmountInDollars={backer.availableToWithdrawInDollars.toString(10)}
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

function DepositStatus({
  tranchedPool,
  backer,
  tranchedPoolsEstimatedApyFromGfi,
}: {
  tranchedPool: TranchedPool | undefined
  backer: TranchedPoolBacker | undefined
  tranchedPoolsEstimatedApyFromGfi: Loadable<TranchedPoolsEstimatedApyFromGfi>
}) {
  const session = useSession()
  if (!tranchedPool || !backer || !tranchedPoolsEstimatedApyFromGfi.loaded) {
    return <></>
  }

  const leverageRatio = tranchedPool.estimatedLeverageRatio
  let estimatedUSDCApy = tranchedPool.estimateJuniorAPY(leverageRatio)
  const apysFromGfi = tranchedPoolsEstimatedApyFromGfi.value.estimatedApyFromGfi[tranchedPool.address]
  const estimatedBackersOnlyApy = apysFromGfi?.backersOnly
  const estimatedLpSeniorPoolMatchingApy = apysFromGfi?.seniorPoolMatching

  const estimatedApy =
    estimatedUSDCApy || estimatedBackersOnlyApy || estimatedLpSeniorPoolMatchingApy
      ? (estimatedUSDCApy || new BigNumber(0))
          .plus(estimatedBackersOnlyApy || new BigNumber(0))
          .plus(estimatedLpSeniorPoolMatchingApy || new BigNumber(0))
      : undefined

  const backerAvailableToWithdrawPercent = backer.availableToWithdrawInDollars.dividedBy(backer.balanceInDollars)
  let rightStatusItem: React.ReactNode
  if (tranchedPool.creditLine.balance.isZero()) {
    // Not yet drawdown
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. APY</div>
        <div className="value">{displayPercent(estimatedUSDCApy)} USDC</div>
        <div className="deposit-status-sub-item-flex">
          <div className="sub-value">{`${displayPercent(estimatedApy)} with GFI`}</div>
          <span data-tip="" data-for="apy-tooltip" data-offset="{'top': 0, 'left': 80}" data-place="bottom">
            <InfoIcon color={session.status === "authenticated" ? "#75c1eb" : "#b4ada7"} />
          </span>
        </div>
      </div>
    )
  } else {
    rightStatusItem = (
      <div className="deposit-status-item">
        <div className="label">Est. Monthly Interest</div>
        {backer.balance.isZero() ? (
          <div className="value">{displayPercent(estimatedUSDCApy)}</div>
        ) : (
          <>
            <div className="value">
              {displayDollars(
                usdcFromAtomic(tranchedPool.estimateMonthlyInterest(estimatedUSDCApy, backer.principalAtRisk))
              )}
            </div>
            <div className="sub-value">{displayPercent(estimatedUSDCApy)} APY</div>
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
        <div className="sub-value">
          {displayDollars(backer.availableToWithdrawInDollars)} ({displayPercent(backerAvailableToWithdrawPercent)})
          available
        </div>
      </div>
      {rightStatusItem}
      <EarnTooltipContent
        longDescription="Includes the base USDC interest yield plus GFI from both liquidity mining and staking."
        rows={[
          {
            text: "Base interest USDC APY",
            value: displayPercent(estimatedUSDCApy),
          },
          {
            text: "Backer liquidity mining GFI APY*",
            value: estimatedBackersOnlyApy
              ? `~${displayPercent(estimatedBackersOnlyApy)}`
              : displayPercent(estimatedBackersOnlyApy),
          },
          {
            text: "LP rewards match GFI APY*",
            subtext: "(expected to launch in March)",
            value: estimatedLpSeniorPoolMatchingApy
              ? `~${displayPercent(estimatedLpSeniorPoolMatchingApy)}`
              : displayPercent(estimatedLpSeniorPoolMatchingApy),
          },
        ]}
        total={{
          text: "Total Est. APY",
          value:
            estimatedApy && (estimatedBackersOnlyApy || estimatedLpSeniorPoolMatchingApy)
              ? `~${displayPercent(estimatedApy)}`
              : displayPercent(estimatedApy),
        }}
        footer={
          <>
            <p>
              *Learn more in the proposals for{" "}
              <a
                href="https://snapshot.org/#/goldfinch.eth/proposal/0xb716c18c38eb1828044aca84a1466ac08221a37a96ce73b04e9caa847e13e0da"
                target="_blank"
                rel="noreferrer"
              >
                Backer liquidity mining
              </a>{" "}
              and{" "}
              <a
                href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
                target="_blank"
                rel="noreferrer"
              >
                staking distributions
              </a>
              .
            </p>
          </>
        }
      />
    </div>
  )
}

function ActionsContainer({
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
  const {user} = useContext(AppContext)
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
  if (
    session.status === "authenticated" &&
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

function V1DealSupplyStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
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
  if (tranchedPool.poolState === PoolState.Open) {
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

function SupplyStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
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
  if (tranchedPool.poolState === PoolState.Open) {
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

function CreditStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  const {user, currentBlock} = useContext(AppContext)
  const transactions = useRecentPoolTransactions({tranchedPool, currentBlock})
  const backer = useBacker({user, tranchedPool})
  const isMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenM})`})

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
          <td className="numeric">
            {isMobile ? displayAbbreviated(usdcFromAtomic(amount)) : displayDollars(usdcFromAtomic(amount))}
          </td>
          <td className="numeric">
            {isMobile ? displayAbbreviated(usdcFromAtomic(yourPortion)) : displayDollars(usdcFromAtomic(yourPortion))}
          </td>
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
  tranchedPool: TranchedPool | undefined
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

const EstimatedSeniorPoolMatchingGFILaunchBanner = () => {
  return (
    <div className="info-banner background-container">
      <div className="message extra-small">
        {iconInfo}
        <span>
          <span className="bold">Note:</span> The APY shown includes estimated GFI rewards that match what LPs would get
          for staking. This is not live yet, but it is has been voted on and is expected to launch in March. Upon
          launch, this reward will be retroactive and ongoing.{" "}
          <a
            href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
            target="_blank"
            rel="noreferrer"
          >
            Learn more in this proposal
          </a>
        </span>
      </div>
    </div>
  )
}

interface TranchedPoolViewURLParams {
  poolAddress: string
}

function TranchedPoolView() {
  const {poolAddress} = useParams<TranchedPoolViewURLParams>()
  const {goldfinchProtocol, backerRewards, pool, gfi, user, network, setSessionData, currentBlock} =
    useContext(AppContext)
  const {
    earnStore: {backers},
  } = useEarn()
  const session = useSession()
  const [tranchedPool, refreshTranchedPool] = useTranchedPool({address: poolAddress, goldfinchProtocol, currentBlock})
  const [showModal, setShowModal] = useState(false)
  const backer = useBacker({user, tranchedPool})
  const [nda, refreshNDA] = useFetchNDA({user, tranchedPool})
  const hasSignedNDA = nda && nda?.status === "success"
  const [tranchedPoolsEstimatedApyFromGfi, setTranchedPoolsEstimatedApyFromGfi] = useState<
    Loadable<TranchedPoolsEstimatedApyFromGfi>
  >({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    if (backers.loaded && pool && gfi && backerRewards) {
      refreshTranchedPoolsEstimatedApyFromGfi(backers, pool, gfi, backerRewards)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backers, pool, gfi, backerRewards])

  async function refreshTranchedPoolsEstimatedApyFromGfi(
    backers: Loaded<TranchedPoolBacker[]>,
    pool: SeniorPoolLoaded,
    gfi: GFILoaded,
    backerRewards: BackerRewardsLoaded
  ) {
    if (
      sameBlock(pool.info.value.currentBlock, gfi.info.value.currentBlock) &&
      sameBlock(gfi.info.value.currentBlock, backerRewards.info.value.currentBlock)
    ) {
      const estimatedApyFromGfi = await backerRewards.estimateApyFromGfiByTranchedPool(
        backers.value.map((backer) => backer.tranchedPool),
        pool,
        gfi
      )
      setTranchedPoolsEstimatedApyFromGfi({
        loaded: true,
        value: {
          currentBlock: gfi.info.value.currentBlock,
          estimatedApyFromGfi,
        },
      })
    }
  }

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

  const showActionsContainer = !isAtMaxCapacity || !backer?.balanceInDollars.isZero()

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice requireUnlock={false} requireGolist={true} isPaused={!!tranchedPool?.isPaused} />
      {user && (
        <>
          {maxCapacityNotice}
          {showActionsContainer ? (
            <>
              <InvestorNotice />
              {tranchedPool && tranchedPoolsEstimatedApyFromGfi.value?.estimatedApyFromGfi[tranchedPool.address] ? (
                <EstimatedSeniorPoolMatchingGFILaunchBanner />
              ) : undefined}
              <ActionsContainer
                tranchedPool={tranchedPool}
                backer={backer}
                onComplete={async () => refreshTranchedPool()}
                tranchedPoolsEstimatedApyFromGfi={tranchedPoolsEstimatedApyFromGfi}
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
