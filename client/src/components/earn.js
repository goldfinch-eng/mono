import React, { useState, useEffect, useContext } from "react"
import EarnActionsContainer from "./earnActionsContainer.js"
import PoolStatus from "./poolStatus.js"
import ConnectionNotice from "./connectionNotice.js"
import { fetchCapitalProviderData, fetchPoolData } from "../ethereum/pool.js"
import { AppContext } from "../App.js"

function Earn(props) {
  const { pool, usdc, creditDesk, user } = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState({})
  const [poolData, setPoolData] = useState({})

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress = user.address
      refreshPoolData(pool, usdc)
      refreshCapitalProviderData(pool, capitalProviderAddress)
    }
    refreshAllData()
  }, [pool, usdc, user])

  function actionComplete() {
    refreshPoolData(pool, usdc)
    return refreshCapitalProviderData(pool, capitalProvider.address)
  }

  async function refreshCapitalProviderData(pool, address) {
    const capitalProvider = await fetchCapitalProviderData(pool, address)
    setCapitalProvider(capitalProvider)
  }

  async function refreshPoolData(pool, usdc) {
    const poolData = await fetchPoolData(pool, usdc && usdc.contract)
    setPoolData(poolData)
  }


  let earnMessage = "Loading..."
  if (capitalProvider.loaded || user.noWeb3) {
    earnMessage = "Earn Portfolio"
  }

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice />
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={actionComplete} />
      <PoolStatus poolData={poolData} creditDesk={creditDesk} />
    </div>
  )
}

export default Earn
