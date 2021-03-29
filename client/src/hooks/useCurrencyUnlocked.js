import { useState, useEffect, useContext } from "react"
import { AppContext } from "../App"

function useCurrencyUnlocked(erc20, { owner, spender, minimum }) {
  const [unlocked, setUnlocked] = useState(true)
  const { goldfinchConfig } = useContext(AppContext)
  minimum = minimum || goldfinchConfig.transactionLimit

  useEffect(() => {
    async function updateUnlocked() {
      let allowance = await erc20.getAllowance({
        owner: owner,
        spender: spender,
      })
      let unlocked = allowance.gt(minimum)
      setUnlocked(unlocked)
    }

    updateUnlocked()
  }, [erc20, owner, spender, goldfinchConfig, minimum])

  return [unlocked, setUnlocked]
}

export default useCurrencyUnlocked
