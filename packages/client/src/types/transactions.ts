import {isPlainObject, isString} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {ERC20} from "../ethereum/erc20"
import {KnownEventData, KnownEventName} from "./events"

export const USDC_APPROVAL_TX_TYPE = "USDC Approval"
export const FIDU_APPROVAL_TX_TYPE = "FIDU Approval"
export const FIDU_USDC_CURVE_APPROVAL_TX_TYPE = "FIDU-USDC Curve Approval"
export const ERC20_APPROVAL_TX_TYPE = "ERC20 Approval"
export const ERC721_APPROVAL_TX_TYPE = "ERC721 Approval"
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
export const UNSTAKE_MULTIPLE_TX_TYPE = "Unstake"
export const SUPPLY_TX_TYPE = "Supply"
export const DEPOSIT_TO_CURVE_TX_TYPE = "Deposit to Curve"
export const DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE = "Deposit to Curve and Stake"
export const ZAP_STAKE_TO_CURVE_TX_TYPE = "Migrate to Curve"

/**
 * This type defines the set of transactions that this application supports sending.
 */
export type TxType =
  | typeof USDC_APPROVAL_TX_TYPE
  | typeof FIDU_APPROVAL_TX_TYPE
  | typeof FIDU_USDC_CURVE_APPROVAL_TX_TYPE
  | typeof ERC20_APPROVAL_TX_TYPE
  | typeof ERC721_APPROVAL_TX_TYPE
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
  | typeof UNSTAKE_MULTIPLE_TX_TYPE
  | typeof SUPPLY_TX_TYPE
  | typeof DEPOSIT_TO_CURVE_TX_TYPE
  | typeof DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE
  | typeof ZAP_STAKE_TO_CURVE_TX_TYPE
export function isTxType(val: unknown): val is TxType {
  return (
    val === USDC_APPROVAL_TX_TYPE ||
    val === FIDU_APPROVAL_TX_TYPE ||
    val === FIDU_USDC_CURVE_APPROVAL_TX_TYPE ||
    val === ERC20_APPROVAL_TX_TYPE ||
    val === ERC721_APPROVAL_TX_TYPE ||
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
    val === UNSTAKE_MULTIPLE_TX_TYPE ||
    val === SUPPLY_TX_TYPE ||
    val === DEPOSIT_TO_CURVE_TX_TYPE ||
    val === DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE ||
    val === ZAP_STAKE_TO_CURVE_TX_TYPE
  )
}

type AmountStringData = {
  amount: string
}

export type CurrentTxDataByType = {
  [USDC_APPROVAL_TX_TYPE]: AmountStringData
  [FIDU_APPROVAL_TX_TYPE]: AmountStringData
  [FIDU_USDC_CURVE_APPROVAL_TX_TYPE]: AmountStringData
  [ERC20_APPROVAL_TX_TYPE]: AmountStringData & {
    amountBN: BigNumber
    erc20: ERC20
  }
  [ERC721_APPROVAL_TX_TYPE]: {
    erc721: any
  }
  [SUPPLY_AND_STAKE_TX_TYPE]: AmountStringData
  [BORROW_TX_TYPE]: AmountStringData
  [PAYMENT_TX_TYPE]: AmountStringData
  [CLAIM_TX_TYPE]: {}
  [ACCEPT_TX_TYPE]: {
    index: number
  }
  [STAKE_TX_TYPE]: {
    amount: string
    ticker: string
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
  [UNSTAKE_MULTIPLE_TX_TYPE]: {
    totalAmount: string
    ticker: string
  }
  [SUPPLY_TX_TYPE]: AmountStringData
  [DEPOSIT_TO_CURVE_TX_TYPE]: {
    fiduAmount: string
    usdcAmount: string
  }
  [DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE]: {
    fiduAmount: string
    usdcAmount: string
  }
  [ZAP_STAKE_TO_CURVE_TX_TYPE]: {
    fiduAmount: string
    usdcAmount: string
  }
}

export const INTEREST_COLLECTED_TX_NAME = "Interest Collected"
export const PRINCIPAL_COLLECTED_TX_NAME = "Principal Collected"
export const RESERVE_FUNDS_COLLECTED_TX_NAME = "Reserve Funds Collected"
export const PRINCIPAL_PAYMENT_TX_NAME = "Principal Payment"
export const INTEREST_PAYMENT_TX_NAME = "Interest Payment"
export const INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME = "Interest and Principal Payment"
export const DRAWDOWN_TX_NAME = "Drawdown"
export const UNSTAKE_TX_NAME = "Unstake"

/**
 * This type defines the set of transactions this application supports handling the
 * historical occurrence of (i.e. in addition to the set, defined by `TxType`, that it
 * *currently* supports sending). Note also that these transaction names need not map
 * 1:1 to the function whose calling comprises the transaction; a given function could map
 * to more than one of these names, so that in the UI we can describe / represent its
 * calling differently depending on e.g. the params of its emitted event.
 */
export type TxName =
  | TxType
  | typeof INTEREST_COLLECTED_TX_NAME
  | typeof PRINCIPAL_COLLECTED_TX_NAME
  | typeof RESERVE_FUNDS_COLLECTED_TX_NAME
  | typeof INTEREST_PAYMENT_TX_NAME
  | typeof PRINCIPAL_PAYMENT_TX_NAME
  | typeof INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME
  | typeof DRAWDOWN_TX_NAME
  | typeof UNSTAKE_TX_NAME
export function isTxName(val: unknown): val is TxName {
  return (
    isTxType(val) ||
    val === INTEREST_COLLECTED_TX_NAME ||
    val === PRINCIPAL_COLLECTED_TX_NAME ||
    val === RESERVE_FUNDS_COLLECTED_TX_NAME ||
    val === INTEREST_PAYMENT_TX_NAME ||
    val === PRINCIPAL_PAYMENT_TX_NAME ||
    val === INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME ||
    val === DRAWDOWN_TX_NAME ||
    val === UNSTAKE_TX_NAME
  )
}

export type AmountUnits = "usdc" | "fidu" | "gfi" | "fidu-usdc-f"
export function isAmountUnits(val: unknown): val is AmountUnits {
  return val === "usdc" || val === "fidu" || val === "gfi" || val === "fidu-usdc-f"
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
  date?: string
  status: "successful"
  eventId: string
  erc20: unknown
  eventData: KnownEventData<T>
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
