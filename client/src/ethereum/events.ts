import BigNumber from "bignumber.js"
import web3 from "../web3"
import moment from "moment"
import _ from "lodash"
import {usdcFromAtomic} from "./erc20"
import {EventData} from "web3-eth-contract"
import {assertNumber} from "../utils"

const EVENT_TYPE_MAP = {
  DepositMade: "Supply",
  WithdrawalMade: "Withdrawal",
  DrawdownMade: "Borrow",
  PaymentCollected: "Payment",
  Approval: "Approval",
  InterestCollected: "Interest Collected",
  PrincipalCollected: "Principal Collected",
  ReserveFundsCollected: "Reserve Funds Collected",
}

const EVENT_AMOUNT_FIELD = {
  WithdrawalMade: "userAmount",
  DepositMade: "amount",
  DrawdownMade: "drawdownAmount",
  PaymentCollected: "paymentAmount",
  InterestCollected: "amount",
  PrincipalCollected: "amount",
  ReserveFundsCollected: "amount",
  Approval: "value",
}

function getEventAmount(eventData: EventData): string {
  return eventData.returnValues[EVENT_AMOUNT_FIELD[eventData.event]]
}
export function getEventAmountBN(eventData: EventData): BigNumber {
  const amount = getEventAmount(eventData)
  return new BigNumber(amount)
}

async function mapEventsToTx(events) {
  const txs = await Promise.all(_.map(_.compact(events), mapEventToTx))
  return _.reverse(_.sortBy(txs, "blockNumber"))
}

function mapEventToTx(event) {
  return web3.eth.getBlock(event.blockNumber).then((block) => {
    let amount = getEventAmount(event)

    // For the interest collected event, we need to support the v1 pool as well, which had a
    // different name for the amount field
    if (event.event === "InterestCollected" && !amount) {
      amount = event.returnValues["poolAmount"]
    }

    // Tranched pool drawdown made events have a different name for the amount field
    if (event.event === "DrawdownMade" && !amount) {
      amount = event.returnValues["amount"]
    }

    assertNumber(block.timestamp)
    return {
      type: event.event,
      name: EVENT_TYPE_MAP[event.event],
      amount: usdcFromAtomic(amount),
      amountBN: new BigNumber(amount),
      id: event.transactionHash,
      blockNumber: event.blockNumber,
      blockTime: block.timestamp,
      date: moment.unix(block.timestamp).format("MMM D, h:mma"),
      status: "successful",
      eventId: event.id,
      erc20: event.erc20,
    }
  })
}

function getBalanceAsOf(events: EventData[], blockNumExclusive: number, subtractiveEventName: string): BigNumber {
  const filtered = events.filter((eventData: EventData) => eventData.blockNumber < blockNumExclusive)
  if (!filtered.length) {
    return new BigNumber(0)
  }
  return BigNumber.sum.apply(
    null,
    filtered.map((eventData) => {
      const amountBN = getEventAmountBN(eventData)
      if (eventData.event === subtractiveEventName) {
        return amountBN.multipliedBy(new BigNumber(-1))
      } else {
        return amountBN
      }
    }),
  )
}

export {mapEventsToTx, getBalanceAsOf}
