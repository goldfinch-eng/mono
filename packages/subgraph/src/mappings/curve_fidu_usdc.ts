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

  // Sells USDC and acquires FIDU
  if (soldId.equals(curveUsdcId)) {
    const transaction = createTransactionFromEvent(event, "CURVE_FIDU_BUY", buyer)
    transaction.category = "CURVE_FIDU_BUY"
    transaction.amount = tokensBought
    transaction.amountToken = "FIDU"
    transaction.save()
  } else {
    // Sell fidu and acquires usdc
    const transaction = createTransactionFromEvent(event, "CURVE_FIDU_SELL", buyer)
    transaction.category = "CURVE_FIDU_SELL"
    transaction.amount = tokensSold
    transaction.amountToken = "FIDU"
    transaction.save()
  }
}
