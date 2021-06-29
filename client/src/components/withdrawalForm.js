import React, { useContext } from "react"
import { usdcFromAtomic, minimumNumber, usdcToAtomic } from "../ethereum/erc20"
import { displayDollars, roundDownPenny } from "../utils"
import { AppContext } from "../App"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import useSendFromUser from "../hooks/useSendFromUser"

function WithdrawalForm(props) {
  const sendFromUser = useSendFromUser()
  const { pool, goldfinchConfig } = useContext(AppContext)

  function action({ transactionAmount }) {
    const withdrawalAmount = usdcToAtomic(transactionAmount)
    return sendFromUser(pool.methods.withdraw(withdrawalAmount), {
      type: "Withdrawal",
      amount: transactionAmount,
    }).then(props.actionComplete)
  }

  const availableAmount = props.capitalProvider.availableToWithdrawalInDollars
  const availableToWithdraw = minimumNumber(
    availableAmount,
    usdcFromAtomic(props.poolData.balance),
    usdcFromAtomic(goldfinchConfig.transactionLimit),
  )

  function renderForm({ formMethods }) {
    return (
      <div className="form-inputs">
        <div className="form-message">Note: the protocol will deduct a 0.50% fee from your withdrawal amount.</div>
        <div className="form-inputs-footer">
          <TransactionInput
            formMethods={formMethods}
            maxAmount={availableToWithdraw}
            rightDecoration={
              <button
                className="enter-max-amount"
                type="button"
                onClick={() => {
                  formMethods.setValue("transactionAmount", roundDownPenny(availableToWithdraw), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              >
                Max
              </button>
            }
          />
          <LoadingButton action={action} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(availableAmount)}`}
      render={renderForm}
      closeForm={props.closeForm}
      maxAmount={availableToWithdraw}
    />
  )
}

export default WithdrawalForm
