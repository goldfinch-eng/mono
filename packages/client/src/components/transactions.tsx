import {assertUnreachable, isString} from "@goldfinch-eng/utils/src/type"
import _ from "lodash"
import React, {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {
  DEPOSIT_MADE_EVENT,
  DRAWDOWN_MADE_EVENT,
  KnownEventData,
  PAYMENT_APPLIED_EVENT,
  TranchedPoolEventType,
  TRANCHED_POOL_EVENT_TYPES,
  WITHDRAWAL_MADE_EVENT,
} from "../types/events"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {TranchedPool} from "../ethereum/tranchedPool"
import {
  ACCEPT_TX_TYPE,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  CurrentTx,
  DRAWDOWN_TX_NAME,
  ERC20_APPROVAL_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  HistoricalTx,
  INTEREST_COLLECTED_TX_NAME,
  INTEREST_PAYMENT_TX_NAME,
  MINT_UID_TX_TYPE,
  PAYMENT_TX_TYPE,
  PRINCIPAL_COLLECTED_TX_NAME,
  RESERVE_FUNDS_COLLECTED_TX_NAME,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  Tx,
  TxType,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../types/transactions"
import {getEtherscanSubdomain, MAX_UINT} from "../ethereum/utils"
import {assertNonNullable, BlockInfo, displayDollars, displayNumber} from "../utils"
import ConnectionNotice from "./connectionNotice"
import {iconCircleCheckLg, iconCircleDownLg, iconCircleUpLg, iconOutArrow} from "./icons"
import {mapEventsToTx, populateDates} from "../ethereum/events"
import BigNumber from "bignumber.js"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {assertIsString} from "@goldfinch-eng/utils"

type TransactionsProps = {
  currentTxs: CurrentTx<TxType>[]
}

function Transactions(props: TransactionsProps) {
  const {user, network, goldfinchProtocol, currentBlock, setLeafCurrentBlock} = useContext(AppContext)
  const [tranchedPoolTxs, setTranchedPoolTxs] = useState<HistoricalTx<TranchedPoolEventType>[]>()
  const currentRoute = useCurrentRoute()

  async function loadTranchedPoolEvents(
    tranchedPools: {[address: string]: TranchedPool},
    goldfinchProtocol: GoldfinchProtocol,
    currentBlock: BlockInfo
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    const tranchedPoolsAddresses = Object.keys(tranchedPools)
    let combinedEvents = _.flatten(
      await Promise.all(
        tranchedPoolsAddresses.map((address) =>
          goldfinchProtocol.queryEvents(
            tranchedPools[address]!.contract.readOnly,
            TRANCHED_POOL_EVENT_TYPES,
            undefined,
            currentBlock.number
          )
        )
      )
    )
    let poolTxs = await mapEventsToTx(combinedEvents, TRANCHED_POOL_EVENT_TYPES, {
      parseName: (eventData: KnownEventData<TranchedPoolEventType>) => {
        switch (eventData.event) {
          case DEPOSIT_MADE_EVENT:
            return SUPPLY_TX_TYPE
          case WITHDRAWAL_MADE_EVENT:
            return WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE
          case PAYMENT_APPLIED_EVENT:
            return INTEREST_PAYMENT_TX_NAME
          case DRAWDOWN_MADE_EVENT:
            return BORROW_TX_TYPE
          default:
            assertUnreachable(eventData.event)
        }
      },
      parseAmount: (eventData: KnownEventData<TranchedPoolEventType>) => {
        switch (eventData.event) {
          case DEPOSIT_MADE_EVENT: {
            return {
              amount: eventData.returnValues.amount,
              units: "usdc",
            }
          }
          case WITHDRAWAL_MADE_EVENT: {
            const sum = new BigNumber(eventData.returnValues.interestWithdrawn).plus(
              new BigNumber(eventData.returnValues.principalWithdrawn)
            )
            return {
              amount: sum.toString(10),
              units: "usdc",
            }
          }
          case PAYMENT_APPLIED_EVENT: {
            return {
              amount: eventData.returnValues.interestAmount,
              units: "usdc",
            }
          }
          case DRAWDOWN_MADE_EVENT: {
            return {
              amount: eventData.returnValues.amount,
              units: "usdc",
            }
          }
          default:
            assertUnreachable(eventData.event)
        }
      },
    })
    poolTxs = await populateDates(poolTxs)
    setTranchedPoolTxs(poolTxs)
    setLeafCurrentBlock(currentRoute, currentBlock)
  }

  useEffect(() => {
    if (!user || !user.borrower || !goldfinchProtocol || !currentBlock) {
      return
    }
    loadTranchedPoolEvents(user.borrower.tranchedPools, goldfinchProtocol, currentBlock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, goldfinchProtocol, currentBlock])

  function transactionRow(tx: Tx) {
    const etherscanSubdomain = getEtherscanSubdomain(network)

    let typeLabel: string = tx.name
    let direction: "inflow" | "outflow" | null = null
    let amount = ""
    let amountSuffix = ""
    let statusCssClass = ""
    let txDate = ""

    if (tx.current) {
      switch (tx.name) {
        case MINT_UID_TX_TYPE:
        case CLAIM_TX_TYPE:
        case ACCEPT_TX_TYPE:
          break
        case USDC_APPROVAL_TX_TYPE:
        case FIDU_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE: {
          const txAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).amount
          let max = MAX_UINT.toString()
          if (txAmount === max) {
            amount = "Maximum"
          } else {
            amount = displayDollars(txAmount)
          }
          break
        }
        case SUPPLY_AND_STAKE_TX_TYPE:
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
          direction = "inflow"
          amount = displayDollars((tx.data as CurrentTx<typeof tx.name>["data"]).amount)
          break
        case WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE:
        case BORROW_TX_TYPE: {
          direction = "outflow"
          amount = displayDollars((tx.data as CurrentTx<typeof tx.name>["data"]).amount)
          break
        }
        case WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE: {
          direction = "outflow"
          amount = displayDollars((tx.data as CurrentTx<typeof tx.name>["data"]).recognizableUsdcAmount)
          break
        }
        case STAKE_TX_TYPE:
          amount = displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount)
          amountSuffix = " FIDU"
          break
        default:
          assertUnreachable(tx)
      }
    } else {
      assertIsString(tx.date)
      txDate = tx.date

      switch (tx.amount.units) {
        case "usdc":
          amount = displayDollars(tx.amount.display)
          break
        case "fidu":
          amount = displayNumber(tx.amount.display)
          amountSuffix = " FIDU"
          break
        case "gfi":
          amount = displayNumber(tx.amount.display)
          amountSuffix = " GFI"
          break
        default:
          assertUnreachable(tx.amount.units)
      }

      switch (tx.name) {
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
        case SUPPLY_AND_STAKE_TX_TYPE:
          direction = "inflow"
          break
        case WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE:
        case BORROW_TX_TYPE:
        case WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
          direction = "outflow"
          break
        case USDC_APPROVAL_TX_TYPE:
        case FIDU_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE: {
          const txAmount = tx.amount.atomic
          let max = MAX_UINT.toString()
          if (txAmount.isEqualTo(max)) {
            amount = "Maximum"
          }
          break
        }
        case CLAIM_TX_TYPE:
        case ACCEPT_TX_TYPE:
        case STAKE_TX_TYPE:
        case MINT_UID_TX_TYPE:
        case UNSTAKE_TX_NAME:
        case INTEREST_COLLECTED_TX_NAME:
        case PRINCIPAL_COLLECTED_TX_NAME:
        case RESERVE_FUNDS_COLLECTED_TX_NAME:
        case INTEREST_PAYMENT_TX_NAME:
        case DRAWDOWN_TX_NAME:
          break
        default:
          assertUnreachable(tx)
      }
    }

    let typeCssClass = ""
    let icon = iconCircleCheckLg
    let amountPrefix = ""
    switch (direction) {
      case "inflow":
        typeCssClass = "inflow"
        icon = iconCircleUpLg
        amountPrefix = "+"
        break
      case "outflow":
        typeCssClass = "outflow"
        icon = iconCircleDownLg
        amountPrefix = "-"
        break
      case null:
        break
      default:
        assertUnreachable(direction)
    }

    if (tx.status === "error") {
      statusCssClass = "error"
      typeLabel = typeLabel + " (failed)"
    } else if (tx.status === "pending") {
      statusCssClass = "pending"
      txDate = "Processing..."
      icon = (
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
      )
    }

    return (
      <tr
        key={tx.current ? `current:${tx.id}` : `historical:${tx.eventId}`}
        className={`transaction-row ${typeCssClass} ${statusCssClass}`}
      >
        <td className="transaction-type">
          {icon}
          {typeLabel}
        </td>
        <td className="numeric">{amount ? `${amountPrefix}${amount}${amountSuffix}` : ""}</td>
        <td className="transaction-date">{txDate}</td>
        <td className="transaction-link">
          <a
            className="inline-button"
            href={isString(etherscanSubdomain) ? `https://${etherscanSubdomain}etherscan.io/tx/${tx.id}` : ""}
            target="_blank"
            rel="noopener noreferrer"
          >
            {iconOutArrow}
          </a>
        </td>
      </tr>
    )
  }

  // Only show txs from currentTxs that are not already in user.pastTxs
  let pendingTxs = _.differenceBy(props.currentTxs, user ? user.info.value.pastTxs : [], "id")
  const compactTxs = _.compact([...pendingTxs, ...(user ? user.info.value.pastTxs : []), ...(tranchedPoolTxs || [])])
  let allTxs
  allTxs = _.sortBy(compactTxs, ["blockNumber", "transactionIndex"])
  allTxs = _.uniqBy(allTxs, "eventId")

  // When you supply and stake, it adds a $0.00 Approval transaction that we want to remove so that we do not confuse the user with an approval amount that they did not explicitly take an action on
  // this only removes approval events that are in the same block number as the supply event
  allTxs = allTxs.reduce(
    ({acc, hasSeenSupplyInCurrentBlock, previousBlock}, curr) => {
      hasSeenSupplyInCurrentBlock = curr.blockNumber === previousBlock && hasSeenSupplyInCurrentBlock
      hasSeenSupplyInCurrentBlock = hasSeenSupplyInCurrentBlock || curr.name === SUPPLY_TX_TYPE

      if (
        hasSeenSupplyInCurrentBlock &&
        [USDC_APPROVAL_TX_TYPE, FIDU_APPROVAL_TX_TYPE, ERC20_APPROVAL_TX_TYPE].includes(curr.name)
      ) {
        return {acc, previousBlock: curr.blockNumber as number, hasSeenSupplyInCurrentBlock}
      } else {
        return {acc: acc.concat(curr), previousBlock: curr.blockNumber as number, hasSeenSupplyInCurrentBlock}
      }
    },
    {acc: [] as any[], hasSeenSupplyInCurrentBlock: false, previousBlock: 0}
  ).acc

  // sort by block number descending (newest first)
  allTxs = _.reverse(allTxs)

  let transactionRows: React.ReactNode[] = [
    <tr key="empty-row" className="empty-row">
      <td>No transactions</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>,
  ]
  if (allTxs.length > 0) {
    transactionRows = allTxs.map(transactionRow)
  }

  return (
    <div className="content-section">
      <div className="page-header">Transactions</div>
      <ConnectionNotice requireUnlock={false} />
      <table className={`table transactions-table ${user ? "" : "placeholder"}`}>
        <thead>
          <tr>
            <th>Type</th>
            <th className="numeric">Amount</th>
            <th className="transaction-date">Date</th>
            <th className="transaction-link"></th>
          </tr>
        </thead>
        <tbody>{transactionRows}</tbody>
      </table>
    </div>
  )
}

export default Transactions
