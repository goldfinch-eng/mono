import { useState, useEffect, useContext } from "react"
import { AppContext } from "../App"

function useCurrencyUnlocked(erc20, { owner, spender, minimum }) {
  const [unlocked, setUnlocked] = useState(true)
  const { goldfinchConfig } = useContext(AppContext)
  minimum = minimum || goldfinchConfig.transactionLimit

  async function refreshUnlocked() {
    let allowance = await erc20.getAllowance({
      owner: owner,
      spender: spender,
    })
    let ul = allowance.gt(minimum)
    if (ul !== unlocked) {
      setUnlocked(ul)
    }
  }

  useEffect(() => {
    refreshUnlocked()
  }, [erc20, owner, spender, goldfinchConfig, minimum])

  return [unlocked, refreshUnlocked]
}

export default useCurrencyUnlocked
