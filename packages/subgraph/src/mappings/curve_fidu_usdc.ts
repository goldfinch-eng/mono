import {BigInt} from "@graphprotocol/graph-ts"
import {TokenExchange} from "../../generated/CurveFiduUSDC/CurveFiduUSDC"
import {FIDU_DECIMALS, USDC_DECIMALS} from "../constants"
import {createTransactionFromEvent} from "../entities/helpers"
import {getOrInitUser} from "../entities/user"

export function handleTokenExchange(event: TokenExchange): void {
  const buyer = event.params.buyer
  const boughtId = event.params.bought_id
  const soldId = event.params.sold_id
  const tokensSold = event.params.tokens_sold
  const tokensBought = event.params.tokens_bought
  getOrInitUser(buyer)

  // FIDU=0 USDC=1
  const curveFiduId = BigInt.fromI32(0)

  const eventName = boughtId.equals(curveFiduId) ? "CURVE_FIDU_BUY" : "CURVE_FIDU_SELL"

  const transaction = createTransactionFromEvent(event, eventName, buyer)
  transaction.category = eventName
  transaction.sentAmount = tokensSold
  transaction.sentToken = soldId.equals(curveFiduId) ? "FIDU" : "USDC"
  transaction.receivedAmount = tokensBought
  transaction.receivedToken = boughtId.equals(curveFiduId) ? "FIDU" : "USDC"

  // sell fidu buy usdc
  if (soldId.equals(curveFiduId)) {
    // usdc / fidu
    transaction.fiduPrice = tokensBought.times(FIDU_DECIMALS).div(USDC_DECIMALS).times(FIDU_DECIMALS).div(tokensSold)
  } else {
    transaction.fiduPrice = tokensSold.times(FIDU_DECIMALS).div(USDC_DECIMALS).times(FIDU_DECIMALS).div(tokensBought)
  }

  transaction.save()
}
