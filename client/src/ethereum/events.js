import BigNumber from "bignumber.js"
import web3 from "../web3"
import moment from "moment"
import _ from "lodash"
import {usdcFromAtomic} from "./erc20"

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

async function mapEventsToTx(events) {
  const txs = await Promise.all(_.map(_.compact(events), mapEventToTx))
  return _.reverse(_.sortBy(txs, "blockNumber"))
}

function mapEventToTx(event) {
  return web3.eth.getBlock(event.blockNumber).then((block) => {
    let amount = event.returnValues[EVENT_AMOUNT_FIELD[event.event]]

    // For the interest collected event, we need to support the v1 pool as well, which had a
    // different name for the amount field
    if (event.event === "InterestCollected" && !amount) {
      amount = event.returnValues["poolAmount"]
    }

    // Tranched pool drawdown made events have a different name for the amount field
    if (event.event === "DrawdownMade" && !amount) {
      amount = event.returnValues["amount"]
    }

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

export {mapEventsToTx}
