import React from "react"
import {CapitalProvider, SeniorPoolData} from "../../ethereum/pool"
import {displayDollars, roundDownPenny} from "../../utils"
import TransactionForm from "../transactionForm"
import Form from "./Form"

export class WithdrawalInfoError extends Error {}
export class ExcessiveWithdrawalError extends Error {}

interface WithdrawalFormProps {
  poolData: SeniorPoolData
  capitalProvider: CapitalProvider
  actionComplete: () => void
  closeForm: () => void
}

function WithdrawalForm(props: WithdrawalFormProps) {
  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(
        roundDownPenny(props.capitalProvider?.availableToWithdrawInDollars),
        2
      )}`}
      render={({formMethods}) => (
        <Form formMethods={formMethods} capitalProvider={props.capitalProvider} poolData={props.poolData} />
      )}
      closeForm={props.closeForm}
    />
  )
}

export default WithdrawalForm
