import React, { useState, useEffect, useContext } from "react"
import { useHistory } from "react-router-dom"
import ConnectionNotice from "./connectionNotice"
import { CapitalProvider, fetchCapitalProviderData, fetchPoolData, PoolData } from "../ethereum/pool"
import { AppContext } from "../App"
import { ERC20, usdcFromAtomic } from "../ethereum/erc20"
import { displayDollars, displayPercent } from "../utils"

function PoolList({ title, children }) {
  return (
    <div className="pools-list table-spaced background-container">
      <div className="table-header background-container-inner">
        <div className="table-cell col40 title">{title}</div>
        <div className="table-cell col22 numeric">Your Balance</div>
        <div className="table-cell col22 numeric">Est. APY</div>
        <div className="table-cell col16"></div>
      </div>
      {children}
    </div>
  )
}

function SeniorPoolCard({ balance, userBalance, apy }) {
  const history = useHistory()

  return (
    <div key="senior-pool" className="table-row background-container-inner">
      <div className="table-cell col40">
        {balance}
        <span className="subheader">Total Pool Balance</span>
      </div>
      <div className="table-cell col22 numeric">{userBalance}</div>
      <div className="table-cell col22 numeric">{apy}</div>
      <div className="table-cell col16 ">
        <button className="view-button" onClick={() => history.push("/earn/pools/senior")}>
          View
        </button>
      </div>
    </div>
  )
}

function Earn(props) {
  const { pool, usdc, user } = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>()
  const [poolData, setPoolData] = useState<PoolData>()

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress = user.loaded && user.address
      refreshPoolData(pool, usdc!)
      refreshCapitalProviderData(pool, capitalProviderAddress)
    }

    if (pool) {
      refreshAllData()
    }
  }, [pool, usdc, user])

  async function refreshCapitalProviderData(pool: any, address: string | boolean) {
    const capitalProvider = await fetchCapitalProviderData(pool, address)
    setCapitalProvider(capitalProvider)
  }

  async function refreshPoolData(pool: any, usdc: ERC20) {
    const poolData = await fetchPoolData(pool, usdc && usdc.contract)
    setPoolData(poolData)
  }

  let earnMessage = "Loading..."
  if (capitalProvider?.loaded || user.noWeb3) {
    earnMessage = "Earn Portfolio"
  }

  return (
    <div className="content-section">
      <div className="page-header">{earnMessage}</div>
      <ConnectionNotice />
      <PoolList title="Senior Pool">
        <SeniorPoolCard
          balance={displayDollars(usdcFromAtomic(poolData?.totalPoolAssets))}
          userBalance={displayDollars(capitalProvider?.availableToWithdrawInDollars)}
          apy={displayPercent(poolData?.estimatedApy)}
        />
      </PoolList>
    </div>
  )
}

export default Earn
