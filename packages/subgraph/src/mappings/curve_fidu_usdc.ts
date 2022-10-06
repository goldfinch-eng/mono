import {BigInt} from "@graphprotocol/graph-ts"
import {TokenExchange} from "../../generated/CurveFiduUSDC/CurveFiduUSDC"
import {createTransactionFromEvent} from "../entities/helpers"
import {getOrInitUser} from "../entities/user"

export function handleTokenExchange(event: TokenExchange): void {
  const buyer = event.params.buyer
  const soldId = event.params.sold_id
  const boughtId = event.params.bought_id
  const tokensSold = event.params.tokens_sold
  const tokensBought = event.params.tokens_bought
  getOrInitUser(buyer)

  const curveUsdcId = BigInt.fromI32(1)

  let transaction = createTransactionFromEvent(event, "CURVE_TOKEN_EXCHANGE", buyer)
  transaction.category = "CURVE_TOKEN_EXCHANGE"
  transaction.amount = tokensSold
  transaction.amountToken = soldId.equals(curveUsdcId) ? "USDC" : "FIDU"
  transaction.save()

  transaction = createTransactionFromEvent(event, "CURVE_TOKEN_EXCHANGE", buyer)
  transaction.category = "CURVE_TOKEN_EXCHANGE"
  transaction.amount = tokensBought
  transaction.amountToken = boughtId.equals(curveUsdcId) ? "USDC" : "FIDU"
  transaction.save()
}
