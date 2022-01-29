import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import moment from "moment"
import {EventData} from "web3-eth-contract"
import {
  DEPOSIT_MADE_EVENT,
  isKnownEventData,
  KnownEventData,
  KnownEventName,
  PoolEventType,
  WITHDRAWAL_MADE_EVENT,
} from "../types/events"
import {assertNumber, defaultSum} from "../utils"
import web3 from "../web3"
import {usdcFromAtomic} from "./erc20"
import {fiduFromAtomic} from "./fidu"
import {gfiFromAtomic} from "./gfi"
import {RichAmount, AmountWithUnits, HistoricalTx, TxName} from "../types/transactions"
import {CombinedRepaymentTx} from "./pool"

async function mapEventsToTx<T extends KnownEventName>(
  events: EventData[],
  known: T[],
  config: EventParserConfig<T>
): Promise<HistoricalTx<T>[]> {
  const txs = await Promise.all(_.compact(events).map((event: EventData) => mapEventToTx<T>(event, known, config)))
  return _.reverse(_.sortBy(_.compact(txs), ["blockNumber", "transactionIndex"]))
}

type EventParserConfig<T extends KnownEventName> = {
  parseName: (eventData: KnownEventData<T>) => TxName
  parseAmount: (eventData: KnownEventData<T>) => AmountWithUnits
}

function getRichAmount(amount: AmountWithUnits): RichAmount {
  if (!amount.amount) {
    console.error("Empty string amount parses as NaN BigNumber.")
  }
  const atomic = new BigNumber(amount.amount)
  let display: string
  switch (amount.units) {
    case "usdc":
      display = usdcFromAtomic(atomic)
      break
    case "fidu":
      display = fiduFromAtomic(atomic)
      break
    case "gfi":
      display = gfiFromAtomic(atomic)
      break
    default:
      assertUnreachable(amount.units)
  }
  return {atomic, display, units: amount.units}
}

async function populateDates<T extends KnownEventName, U extends HistoricalTx<T> | CombinedRepaymentTx>(txs: U[]) {
  return await Promise.all(
    txs.map((tx) => {
      return web3.readOnly.eth.getBlock(tx.blockNumber).then((block) => {
        assertNumber(block.timestamp)
        tx.date = moment.unix(block.timestamp).format("MMM D, h:mma")
        return tx
      })
    })
  )
}

async function mapEventToTx<T extends KnownEventName>(
  eventData: EventData,
  known: T[],
  config: EventParserConfig<T>
): Promise<HistoricalTx<T> | undefined> {
  if (isKnownEventData<T>(eventData, known)) {
    const parsedName = config.parseName(eventData)
    const parsedAmount = config.parseAmount(eventData)

    return {
      current: false,
      type: eventData.event,
      name: parsedName,
      amount: getRichAmount(parsedAmount),
      id: eventData.transactionHash,
      blockNumber: eventData.blockNumber,
      transactionIndex: eventData.transactionIndex,
      status: "successful",
      eventId: (eventData as any).id,
      erc20: (eventData as any).erc20,
    }
  } else {
    console.error(`Unexpected event type: ${eventData.event}. Expected: ${known}`)
    return
  }
}

function getBalanceAsOf<T extends KnownEventName, U extends T>(
  events: KnownEventData<T>[],
  blockNumExclusive: number,
  subtractiveEventName: U,
  getEventAmount: (eventData: KnownEventData<T>) => BigNumber
): BigNumber {
  const filtered = events.filter((eventData: KnownEventData<T>) => eventData.blockNumber < blockNumExclusive)
  return defaultSum(
    filtered.map((eventData) => {
      const amount = getEventAmount(eventData)
      if (eventData.event === subtractiveEventName) {
        return amount.multipliedBy(new BigNumber(-1))
      } else {
        return amount
      }
    })
  )
}

function getPoolEventAmount(eventData: KnownEventData<PoolEventType>): BigNumber {
  switch (eventData.event) {
    case DEPOSIT_MADE_EVENT:
      return new BigNumber(eventData.returnValues.amount)
    case WITHDRAWAL_MADE_EVENT:
      return new BigNumber(eventData.returnValues.userAmount)

    default:
      assertUnreachable(eventData.event)
  }
}

function reduceToKnown<T extends KnownEventName>(events: EventData[], knownEventNames: T[]) {
  const reduced = events.reduce<{
    known: KnownEventData<T>[]
    unknown: EventData[]
  }>(
    (acc, curr) => {
      if (isKnownEventData(curr, knownEventNames)) {
        acc.known.push(curr)
      } else {
        acc.unknown.push(curr)
      }
      return acc
    },
    {
      known: [],
      unknown: [],
    }
  )
  if (reduced.unknown.length) {
    console.error(
      `Unexpected event types: ${reduced.unknown.map(
        (eventData: EventData) => eventData.event
      )}. Expected: ${knownEventNames}`
    )
  }
  return reduced.known
}

export {mapEventsToTx, getBalanceAsOf, getPoolEventAmount, reduceToKnown, populateDates}
