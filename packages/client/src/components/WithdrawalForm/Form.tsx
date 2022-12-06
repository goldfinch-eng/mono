import React from "react"
import {CapitalProvider, SeniorPoolData} from "../../ethereum/pool"

export class WithdrawalInfoError extends Error {}
export class ExcessiveWithdrawalError extends Error {}

interface FormProps {
  formMethods: any
  capitalProvider: CapitalProvider
  poolData: SeniorPoolData
}

export default function Form(props: FormProps) {
  return <div>REMOVED!</div>
}
