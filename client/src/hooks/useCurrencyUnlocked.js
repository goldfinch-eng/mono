import {useState, useEffect, useContext, useCallback} from "react"
import {AppContext} from "../App"

function useCurrencyUnlocked(erc20, {owner, spender, minimum}) {
  const [unlocked, setUnlocked] = useState(true)
  const {goldfinchConfig} = useContext(AppContext)
  minimum = minimum || goldfinchConfig.transactionLimit

  const refreshUnlocked = useCallback(async () => {
    if (!erc20 || !owner || !spender) {
      return
    }
    let allowance = await erc20.getAllowance({
      owner: owner,
      spender: spender,
    })
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
