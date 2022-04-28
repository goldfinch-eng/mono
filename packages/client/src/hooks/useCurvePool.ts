import {assertNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {useContext} from "react"
import {AppContext} from "../App"
import {getMultiplierDecimals, Ticker} from "../ethereum/erc20"
import {useFromSameBlock} from "./useFromSameBlock"

type CurvePoolData = {
  estimateSlippage: (fiduAmount: BigNumber, usdcAmount: BigNumber) => Promise<Slippage>
}

export type Slippage = {
  // Slippage percentage (denominated as a fraction - i.e. 10% would be represented as "10")
  slippage: BigNumber
  // True if there was an error in Curve when calculating slippage.
  //
  // We've observed execution failures when invoking the #calc_token_amount function
  // with very large input values. If this happens, ensure that the error is handled properly.
  error: boolean
}

export default function useCurvePool(): CurvePoolData {
  const {pool: _pool, stakingRewards: _stakingRewards, currentBlock} = useContext(AppContext)
  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _pool, _stakingRewards)
  const pool = consistent?.[0]
  const stakingRewards = consistent?.[1]

  async function estimateSlippage(fiduAmount: BigNumber, usdcAmount: BigNumber): Promise<Slippage> {
    if (fiduAmount.isZero() && usdcAmount.isZero()) {
      return {slippage: new BigNumber(0), error: false}
    }

    assertNonNullable(stakingRewards)
    assertNonNullable(pool)

    const fiduSharePrice = new BigNumber(pool.info.value.poolData.sharePrice)
    const virtualPrice = stakingRewards.info.value.curveLPTokenPrice
    let estimatedTokensReceived
    try {
      estimatedTokensReceived = await stakingRewards.curvePool.readOnly.methods
        .calc_token_amount([fiduAmount.toString(10), usdcAmount.toString(10)])
        .call(undefined, "latest")
        .catch((error) => {
          console.error("Unable to calculate token amount for Curve deposit", error)

          return new BigNumber(0)
        })
    } catch (error) {
      // We've observed execution failures when invoking the #calc_token_amount function
      // with very large input values. If this happens, return an error response for
      // the caller(s) of this function to handle properly
      return {slippage: new BigNumber(0), error: true}
    }

    const virtualValue = new BigNumber(estimatedTokensReceived)
      .times(new BigNumber(virtualPrice))
      .div(getMultiplierDecimals(Ticker.FIDU))

    const realValue = fiduAmount
      .times(fiduSharePrice)
      .div(getMultiplierDecimals(Ticker.FIDU))
      .plus(usdcAmount.times(getMultiplierDecimals(Ticker.FIDU)).div(getMultiplierDecimals(Ticker.USDC)))

    return {slippage: virtualValue.div(realValue).minus(new BigNumber(1)), error: false}
  }

  return {estimateSlippage}
}
