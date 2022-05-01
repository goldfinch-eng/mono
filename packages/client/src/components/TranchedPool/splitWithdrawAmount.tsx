import {BigNumber} from "bignumber.js"
import {TokenInfo} from "../../ethereum/tranchedPool"

export function splitWithdrawAmount(
  withdrawAmount: BigNumber,
  tokenInfos: TokenInfo[]
): {tokenIds: string[]; amounts: string[]} {
  let amountLeft = withdrawAmount
  let tokenIds: string[] = []
  let amounts: string[] = []

  tokenInfos.forEach((tokenInfo) => {
    if (amountLeft.isZero() || tokenInfo.principalRedeemable.plus(tokenInfo.interestRedeemable).isZero()) {
      return
    }

    let amountFromThisToken = BigNumber.min(
      amountLeft,
      tokenInfo.principalRedeemable.plus(tokenInfo.interestRedeemable)
    )
    amountLeft = amountLeft.minus(amountFromThisToken)
    tokenIds.push(tokenInfo.id)
    amounts.push(amountFromThisToken.toString())
  })

  return {tokenIds, amounts}
}
