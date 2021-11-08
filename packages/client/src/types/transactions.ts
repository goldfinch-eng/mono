import {isNumber, isPlainObject, isString} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {ERC20} from "../ethereum/erc20"
import {isKnownEventName, KnownEventName} from "./events"

export const USDC_APPROVAL_TX_TYPE = "USDC Approval"
export const FIDU_APPROVAL_TX_TYPE = "FIDU Approval"
export const ERC20_APPROVAL_TX_TYPE = "ERC20 Approval"
export const SUPPLY_AND_STAKE_TX_TYPE = "Supply and Stake"
export const BORROW_TX_TYPE = "Borrow"
export const PAYMENT_TX_TYPE = "Payment"
export const CLAIM_TX_TYPE = "Claim"
export const ACCEPT_TX_TYPE = "Accept"
export const STAKE_TX_TYPE = "Stake"
export const MINT_UID_TX_TYPE = "Mint UID"
export const WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE = "Withdraw from Borrower Pool"
export const WITHDRAW_FROM_SENIOR_POOL_TX_TYPE = "Withdraw from Senior Pool"
export const UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE = "Unstake and Withdraw"
export const SUPPLY_TX_TYPE = "Supply"

/**
 * This type defines the set of transactions that this application supports sending.
 */
export type TxType =
  | typeof USDC_APPROVAL_TX_TYPE
  | typeof FIDU_APPROVAL_TX_TYPE
  | typeof ERC20_APPROVAL_TX_TYPE
  | typeof SUPPLY_AND_STAKE_TX_TYPE
  | typeof BORROW_TX_TYPE
  | typeof PAYMENT_TX_TYPE
  | typeof CLAIM_TX_TYPE
  | typeof ACCEPT_TX_TYPE
  | typeof STAKE_TX_TYPE
  | typeof MINT_UID_TX_TYPE
  | typeof WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE
  | typeof WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
  | typeof UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
  | typeof SUPPLY_TX_TYPE
export function isTxType(val: unknown): val is TxType {
  return (
    val === USDC_APPROVAL_TX_TYPE ||
    val === FIDU_APPROVAL_TX_TYPE ||
    val === ERC20_APPROVAL_TX_TYPE ||
    val === SUPPLY_AND_STAKE_TX_TYPE ||
    val === BORROW_TX_TYPE ||
    val === PAYMENT_TX_TYPE ||
    val === CLAIM_TX_TYPE ||
    val === ACCEPT_TX_TYPE ||
    val === STAKE_TX_TYPE ||
    val === MINT_UID_TX_TYPE ||
    val === WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE ||
    val === WITHDRAW_FROM_SENIOR_POOL_TX_TYPE ||
    val === UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE ||
    val === SUPPLY_TX_TYPE
  )
}

type AmountStringData = {
  amount: string
}

export type CurrentTxDataByType = {
  [USDC_APPROVAL_TX_TYPE]: AmountStringData
  [FIDU_APPROVAL_TX_TYPE]: AmountStringData
  [ERC20_APPROVAL_TX_TYPE]: AmountStringData & {
    amountBN: BigNumber
    erc20: ERC20
  }
  [SUPPLY_AND_STAKE_TX_TYPE]: AmountStringData
  [BORROW_TX_TYPE]: AmountStringData
  [PAYMENT_TX_TYPE]: AmountStringData
  [CLAIM_TX_TYPE]: {}
  [ACCEPT_TX_TYPE]: {
    index: number
  }
  [STAKE_TX_TYPE]: {
    fiduAmount: string
  }
  [MINT_UID_TX_TYPE]: {}
  [WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE]: AmountStringData
  [WITHDRAW_FROM_SENIOR_POOL_TX_TYPE]: {
    recognizableUsdcAmount: string
    fiduAmount: string
  }
  [UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE]: {
    recognizableUsdcAmount: string
    fiduAmount: string
    tokens: Array<{
      id: string
      fiduAmount: string
    }>
  }
  [SUPPLY_TX_TYPE]: AmountStringData
}

export const INTEREST_COLLECTED_TX_NAME = "Interest Collected"
export const PRINCIPAL_COLLECTED_TX_NAME = "Principal Collected"
export const RESERVE_FUNDS_COLLECTED_TX_NAME = "Reserve Funds Collected"
export const INTEREST_PAYMENT_TX_NAME = "Interest Payment"
export const DRAWDOWN_TX_NAME = "Drawdown"
export const UNSTAKE_TX_NAME = "Unstake"

/**
 * This type defines the set of transactions this application supports handling the
 * historical occurrence of.
 */
export type TxName =
  | TxType
  | typeof INTEREST_COLLECTED_TX_NAME
  | typeof PRINCIPAL_COLLECTED_TX_NAME
  | typeof RESERVE_FUNDS_COLLECTED_TX_NAME
  | typeof INTEREST_PAYMENT_TX_NAME
  | typeof DRAWDOWN_TX_NAME
  | typeof UNSTAKE_TX_NAME
export function isTxName(val: unknown): val is TxName {
  return (
    isTxType(val) ||
    val === INTEREST_COLLECTED_TX_NAME ||
    val === PRINCIPAL_COLLECTED_TX_NAME ||
    val === RESERVE_FUNDS_COLLECTED_TX_NAME ||
    val === INTEREST_PAYMENT_TX_NAME ||
    val === DRAWDOWN_TX_NAME ||
    val === UNSTAKE_TX_NAME
  )
}

export type AmountUnits = "usdc" | "fidu" | "gfi"
export function isAmountUnits(val: unknown): val is AmountUnits {
  return val === "usdc" || val === "fidu" || val === "gfi"
}

export type AmountWithUnits = {
  amount: string
  units: AmountUnits
}

export type RichAmount = {
  display: string
  atomic: BigNumber
  units: AmountUnits
}
export function isRichAmount(obj: unknown): obj is RichAmount {
  return isPlainObject(obj) && isString(obj.display) && BigNumber.isBigNumber(obj.atomic) && isAmountUnits(obj.units)
}

export type HistoricalTx<T extends KnownEventName> = {
  current: false
  type: T
  name: TxName
  amount: RichAmount
  id: string
  blockNumber: number
  transactionIndex: number
  blockTime: number
  date: string
  status: "successful"
  eventId: string
  erc20: unknown
}
export function isHistoricalTx(obj: unknown): obj is HistoricalTx<KnownEventName> {
  return (
    isPlainObject(obj) &&
    isKnownEventName(obj.type) &&
    isTxName(obj.name) &&
    isRichAmount(obj.amount) &&
    isString(obj.id) &&
    isNumber(obj.blockNumber) &&
    isNumber(obj.transactionIndex) &&
    isNumber(obj.blockTime) &&
    isString(obj.date) &&
    obj.status === "successful" &&
    isString(obj.eventId) &&
    "erc20" in obj
  )
}

type BaseCurrentTx<T extends TxType> = {
  current: true
  blockNumber: number | undefined
  blockTime: number
  confirmations: number
  onConfirm: ((tx: PendingCurrentTx<T>) => void) | undefined
  id: number | string
  name: T
  data: CurrentTxDataByType[T]
}

export type PendingCurrentTx<T extends TxType> = BaseCurrentTx<T> & {
  status: "pending"
  errorMessage: undefined
}
export type FailedCurrentTx<T extends TxType> = BaseCurrentTx<T> & {
  status: "error"
  errorMessage: string
}
export type SuccessfulCurrentTx<T extends TxType> = BaseCurrentTx<T> & {
  status: "successful"
  errorMessage: undefined
}

export type CurrentTx<T extends TxType> = PendingCurrentTx<T> | FailedCurrentTx<T> | SuccessfulCurrentTx<T>

export type Tx = CurrentTx<TxType> | HistoricalTx<KnownEventName>
