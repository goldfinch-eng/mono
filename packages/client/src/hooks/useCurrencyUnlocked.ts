import {useState, useEffect, useContext, useCallback} from "react"
import {AppContext} from "../App"

function useCurrencyUnlocked(erc20, {owner, spender, minimum}): [boolean, () => Promise<void>] {
  const [unlocked, setUnlocked] = useState(true)
  const {goldfinchConfig} = useContext(AppContext)
  minimum = minimum || goldfinchConfig.transactionLimit

  const refreshUnlocked = useCallback(async () => {
    if (!erc20 || !owner || !spender) {
      return
    }
    let allowance = await erc20.getAllowance(
      {
        owner: owner,
        spender: spender,
      },
      // TODO For the sake of consistency (of all chain data rendered in the UI being based on
      // the same block), it would be ideal to refresh this allowance by way of using the
      // `refreshCurrentBlock()` method from app context. Then we would pass `currentBlock`
      // from app context here.
      undefined
    )
    let ul = allowance.gt(minimum)
    if (ul !== unlocked) {
      setUnlocked(ul)
    }
  }, [erc20, owner, spender, minimum, unlocked])

  useEffect(() => {
    refreshUnlocked()
  }, [refreshUnlocked])

  return [unlocked, refreshUnlocked]
}

export default useCurrencyUnlocked
