import {assertIsString} from "@goldfinch-eng/utils"
import {assertUnreachable, isString} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import React, {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {mapEventsToTx, populateDates} from "../ethereum/events"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {tranchedPoolEventParserConfig} from "../ethereum/tranchedPool"
import {getEtherscanSubdomain, MAX_UINT} from "../ethereum/utils"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {
  DRAWDOWN_MADE_EVENT,
  KnownEventName,
  PAYMENT_APPLIED_EVENT,
  POOL_CREATED_EVENT,
  TRANCHED_POOL_EVENT_TYPES,
} from "../types/events"
import {
  ACCEPT_TX_TYPE,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  CurrentTx,
  DRAWDOWN_TX_NAME,
  ERC20_APPROVAL_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  HistoricalTx,
  INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME,
  INTEREST_COLLECTED_TX_NAME,
  INTEREST_PAYMENT_TX_NAME,
  MINT_UID_TX_TYPE,
  PAYMENT_TX_TYPE,
  PRINCIPAL_COLLECTED_TX_NAME,
  PRINCIPAL_PAYMENT_TX_NAME,
  RESERVE_FUNDS_COLLECTED_TX_NAME,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  Tx,
  TxType,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
  UNSTAKE_TX_TYPE,
  DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
  FIDU_USDC_CURVE_APPROVAL_TX_TYPE,
  DEPOSIT_TO_CURVE_TX_TYPE,
  ZAP_STAKE_TO_CURVE_TX_TYPE,
  ERC721_APPROVAL_TX_TYPE,
} from "../types/transactions"
import {assertNonNullable, BlockInfo, displayDollars, displayNumber} from "../utils"
import ConnectionNotice from "./connectionNotice"
import {iconCircleCheckLg, iconCircleDownLg, iconCircleUpLg, iconOutArrow} from "./icons"

type TransactionsProps = {
  currentTxs: CurrentTx<TxType>[]
}

type TransactionsTypes = HistoricalTx<KnownEventName> | CurrentTx<TxType>

const noTransactionRow: React.ReactNode = (
  <tr key="empty-row" className="empty-row">
    <td>No transactions</td>
    <td></td>
    <td></td>
    <td></td>
  </tr>
)

function Transactions(props: TransactionsProps) {
  const {user, network, goldfinchProtocol, currentBlock, setLeafCurrentBlock} = useContext(AppContext)
  const [transactionRows, setTransactionRows] = useState<TransactionsTypes[]>([])
  const currentRoute = useCurrentRoute()

  async function loadTranchedPoolAddresses(
    goldfinchProtocol: GoldfinchProtocol,
    currentBlock: BlockInfo
  ): Promise<string[]> {
    let poolEvents = await goldfinchProtocol.queryEvents(
      "GoldfinchFactory",
      [POOL_CREATED_EVENT],
      undefined,
      currentBlock.number
    )
    return poolEvents.map((e) => e.returnValues.pool)
  }

  async function loadTranchedPoolEvents(
    userAddress: string,
    borrowerTranchedPools: string[],
    goldfinchProtocol: GoldfinchProtocol,
    currentBlock: BlockInfo
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    let tranchedPoolsAddresses: string[] = await loadTranchedPoolAddresses(goldfinchProtocol, currentBlock)
    let combinedEvents = _.flatten(
      await Promise.all([
        ...borrowerTranchedPools.map((address: string) =>
          goldfinchProtocol.queryEvents(
            goldfinchProtocol.getContract("TranchedPool", address).readOnly,
            [PAYMENT_APPLIED_EVENT, DRAWDOWN_MADE_EVENT],
            undefined,
            currentBlock.number
          )
        ),
        ...tranchedPoolsAddresses.map((address: string) =>
          goldfinchProtocol.queryEvents(
            goldfinchProtocol.getContract("TranchedPool", address).readOnly,
            TRANCHED_POOL_EVENT_TYPES,
            {
              owner: userAddress,
              payer: userAddress,
              borrower: userAddress,
            },
            currentBlock.number
          )
        ),
      ])
    )
    let poolTxs: HistoricalTx<KnownEventName>[] = await mapEventsToTx(
      combinedEvents,
      TRANCHED_POOL_EVENT_TYPES,
      tranchedPoolEventParserConfig
    )
    setLeafCurrentBlock(currentRoute, currentBlock)
    return await populateDates(poolTxs)
  }

  useEffect(() => {
    if (!user || !goldfinchProtocol || !currentBlock) {
      return
    }
    loadTranchedPoolEvents(
      user.address,
      user.borrower ? Object.keys(user.borrower.tranchedPools) : [],
      goldfinchProtocol,
      currentBlock
    ).then((tranchedPoolTxs: HistoricalTx<KnownEventName>[]) => {
      // Only show txs from currentTxs that are not already in user.pastTxs
      let pendingTxs: TransactionsTypes[] = _.differenceBy(props.currentTxs, user ? user.info.value.pastTxs : [], "id")
      const compactTxs: TransactionsTypes[] = _.compact([
        ...pendingTxs,
        ...(user ? user.info.value.pastTxs : []),
        ...(tranchedPoolTxs || []),
      ])
      let allTxs: TransactionsTypes[]
      allTxs = _.sortBy(compactTxs, ["blockNumber", "transactionIndex"])
      allTxs = _.uniqBy(allTxs, "eventId")

      // When you supply and stake, it adds a $0.00 Approval transaction that we want to remove so that we do not
      // confuse the user with an approval amount that they did not explicitly take an action on
      // this only removes approval events that are in the same block number as the supply event
      allTxs = allTxs.reduce(
        ({acc, hasSeenSupplyInCurrentBlock, previousBlock}, curr) => {
          hasSeenSupplyInCurrentBlock = curr.blockNumber === previousBlock && hasSeenSupplyInCurrentBlock
          hasSeenSupplyInCurrentBlock =
            hasSeenSupplyInCurrentBlock ||
            [SUPPLY_TX_TYPE, STAKE_TX_TYPE, DEPOSIT_TO_CURVE_TX_TYPE, DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE].includes(
              curr.name
            )
          if (
            hasSeenSupplyInCurrentBlock &&
            [
              USDC_APPROVAL_TX_TYPE,
              FIDU_APPROVAL_TX_TYPE,
              FIDU_USDC_CURVE_APPROVAL_TX_TYPE,
              ERC20_APPROVAL_TX_TYPE,
            ].includes(curr.name)
          ) {
            return {acc, previousBlock: curr.blockNumber as number, hasSeenSupplyInCurrentBlock}
          } else {
            return {acc: acc.concat(curr), previousBlock: curr.blockNumber as number, hasSeenSupplyInCurrentBlock}
          }
        },
        {acc: [] as TransactionsTypes[], hasSeenSupplyInCurrentBlock: false, previousBlock: 0}
      ).acc

      // sort by block number descending (newest first)
      allTxs = _.reverse(allTxs)
      setTransactionRows(allTxs)
    })
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
        case FIDU_USDC_CURVE_APPROVAL_TX_TYPE:
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
        case ERC721_APPROVAL_TX_TYPE:
          amount = "Maximum"
          break
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
        case UNSTAKE_TX_TYPE: {
          direction = "outflow"
          amount = displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).totalAmount)
          break
        }
        case STAKE_TX_TYPE:
          direction = "outflow"
          amount = displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).amount)
          amountSuffix = ` ${(tx.data as CurrentTx<typeof tx.name>["data"]).ticker}`
          break
        case DEPOSIT_TO_CURVE_TX_TYPE:
        case DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE:
          let fiduAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount
          let usdcAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).usdcAmount
          if (new BigNumber(fiduAmount).isZero() && !new BigNumber(usdcAmount).isZero()) {
            // USDC-only deposit
            amount = displayDollars(usdcAmount)
          } else if (!new BigNumber(fiduAmount).isZero() && new BigNumber(usdcAmount).isZero()) {
            // FIDU-only deposit
            amount = displayNumber(fiduAmount)
            amountSuffix = " FIDU"
          } else {
            throw new Error("Cannot deposit both FIDU and USDC")
          }
          break
        case ZAP_STAKE_TO_CURVE_TX_TYPE:
          fiduAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount
          usdcAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).usdcAmount
          amount = `${displayNumber(fiduAmount)} FIDU, ${displayDollars(usdcAmount)}`
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
        case "fidu-usdc-f":
          amount = displayNumber(tx.amount.display)
          amountSuffix = " FIDU-USDC-F"
          break
        default:
          assertUnreachable(tx.amount.units)
      }

      switch (tx.name) {
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
        case SUPPLY_AND_STAKE_TX_TYPE:
        case DEPOSIT_TO_CURVE_TX_TYPE:
        case DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE:
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
        case FIDU_USDC_CURVE_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE: {
          const txAmount = tx.amount.atomic
          let max = MAX_UINT.toString()
          if (txAmount.isEqualTo(max)) {
            amount = "Maximum"
          }
          break
        }
        case ERC721_APPROVAL_TX_TYPE:
          amount = "Maximum"
          break
        case CLAIM_TX_TYPE:
        case ACCEPT_TX_TYPE:
        case STAKE_TX_TYPE:
        case MINT_UID_TX_TYPE:
        case UNSTAKE_TX_NAME:
        case INTEREST_COLLECTED_TX_NAME:
        case PRINCIPAL_COLLECTED_TX_NAME:
        case RESERVE_FUNDS_COLLECTED_TX_NAME:
        case INTEREST_PAYMENT_TX_NAME:
        case PRINCIPAL_PAYMENT_TX_NAME:
        case INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME:
        case DRAWDOWN_TX_NAME:
        case ZAP_STAKE_TO_CURVE_TX_TYPE:
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
        <tbody>{transactionRows.length ? transactionRows.map(transactionRow) : noTransactionRow}</tbody>
      </table>
    </div>
  )
}

export default Transactions
