import {useState, useEffect, useContext} from "react"
import BigNumber from "bignumber.js"

import {AppContext} from "../App"
import {getOneInchContract} from "../ethereum/oneInch"
import {roundUpPenny, displayNumber} from "../utils"

function useOneInchQuote({from, to, decimalAmount, parts = 10}) {
  const {network} = useContext(AppContext)
  const [expectedReturn, setExpectedReturn] = useState(null)
  const [isLoading, setLoading] = useState(false)

  useEffect(() => {
    const oneInch = getOneInchContract(network.name)

    async function getExpectedReturn() {
      if (from === to || !decimalAmount) {
        setExpectedReturn(null)
        return
      }

      setLoading(true)

      let atomicAmount = from.atomicAmount(decimalAmount)
      const result = await oneInch.methods.getExpectedReturn(from.address, to.address, atomicAmount, parts, 0).call()

      setLoading(false)
      setExpectedReturn(result)
    }

    getExpectedReturn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, decimalAmount && decimalAmount.toString(), parts, network])

  return [expectedReturn, isLoading]
}

// Calculate an estimated amount in `from` currency that gives at least targetMinAmount in `to` currency.
// The amount is suitable for use in useOneInchQuote.
//
// The function estimates a reasonable amount by getting a quote from 1Inch, calculating the spread,
// and adjusting the target amount by the spread + some pre-defined padding.
function useAmountTargetingMinAmount({from, to, targetMinAmount, padding = new BigNumber("0.0005")}) {
  const [amount, setAmount] = useState(null)
  let [quote, isLoading] = useOneInchQuote({from, to, decimalAmount: targetMinAmount})

  useEffect(() => {
    if (quote) {
      let decimalReturnAmount = to.decimalAmount(quote.returnAmount)
      let spread = targetMinAmount.minus(decimalReturnAmount).dividedBy(decimalReturnAmount)
      let amount = targetMinAmount.plus(targetMinAmount.times(spread))
      let paddedAmount = new BigNumber(roundUpPenny(amount.plus(amount.times(padding))))
      setAmount(paddedAmount)
    } else {
      setAmount(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  return [amount, isLoading]
}

function formatQuote({erc20, quote, decimals = 2, wrap = ""}) {
  if (!quote) {
    return ""
  }

  let left = wrap[0] || ""
  let right = wrap[1] || ""

  let {returnAmount} = quote
  return `${left}${displayNumber(erc20.decimalAmount(returnAmount), decimals)} ${erc20.ticker}${right}`
}

export {useOneInchQuote, formatQuote, useAmountTargetingMinAmount}
