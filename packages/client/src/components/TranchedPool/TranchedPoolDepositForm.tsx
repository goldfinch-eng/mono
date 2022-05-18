import {BigNumber} from "bignumber.js"
import {AppContext} from "../../App"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {TranchedPool, TranchedPoolBacker, TRANCHES} from "../../ethereum/tranchedPool"
import {decimalPlaces} from "../../ethereum/utils"
import useERC20Permit from "../../hooks/useERC20Permit"
import DefaultGoldfinchClient from "../../hooks/useGoldfinchClient"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {useSession} from "../../hooks/useSignIn"
import {SUPPLY_TX_TYPE} from "../../types/transactions"
import {assertError, displayDollars} from "../../utils"
import LoadingButton from "../loadingButton"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"

export function TranchedPoolDepositForm({
  backer,
  tranchedPool,
  actionComplete,
  closeForm,
}: {
  backer: TranchedPoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}) {
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
            maxAmount={maxTxAmountInDollars}
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
