import React, { useState, useEffect, useContext } from "react"
import { useHistory } from "react-router-dom"
import ConnectionNotice from "./connectionNotice"
import { CapitalProvider, fetchCapitalProviderData, fetchPoolData, PoolData } from "../ethereum/pool"
import { AppContext } from "../App"
import { ERC20, usdcFromAtomic } from "../ethereum/erc20"
import { croppedAddress, displayDollars, displayPercent } from "../utils"
import { GoldfinchProtocol } from "../ethereum/GoldfinchProtocol"
import { TranchedPool } from "../ethereum/tranchedPool"
import { PoolCreated } from "../typechain/web3/GoldfinchFactory"

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

function TranchedPoolCard({ tranchedPool }: { tranchedPool: TranchedPool }) {
  const history = useHistory()

  return (
    <div key={`junior-pool-${tranchedPool.address}`} className="table-row background-container-inner">
      <div className="table-cell col40 pool-info">
        <img
          className={`icon ${process.env.NODE_ENV === "development" && "pixelated"}`}
          src={tranchedPool.metadata?.icon}
          alt="pool-icon"
        />
        <div className="name">
          <span>{tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}</span>
          <span className="subheader">{tranchedPool.metadata?.category}</span>
        </div>
      </div>
      <div className="table-cell col22 numeric">{"$100"}</div>
      <div className="table-cell col22 numeric">{"1,000%"}</div>
      <div className="table-cell col16 ">
        <button className="view-button" onClick={() => history.push(`/earn/pools/junior/${tranchedPool.address}`)}>
          View
        </button>
      </div>
    </div>
  )
}

function useTranchedPools({
  goldfinchProtocol,
}: {
  goldfinchProtocol?: GoldfinchProtocol
}): { tranchedPools: TranchedPool[]; status: string } {
  let [tranchedPools, setTranchedPools] = useState<TranchedPool[]>([])
  let [status, setStatus] = useState<string>("loading")

  useEffect(() => {
    async function loadTranchedPools(goldfinchProtocol: GoldfinchProtocol) {
      let poolEvents = ((await goldfinchProtocol.queryEvents("GoldfinchFactory", [
        "PoolCreated",
      ])) as unknown) as PoolCreated[]
      let poolAddresses = poolEvents.map(e => e.returnValues.pool)
      let tranchedPools = poolAddresses.map(a => new TranchedPool(a, goldfinchProtocol))
      await Promise.all(tranchedPools.map(p => p.initialize()))
      setTranchedPools(tranchedPools)
      setStatus("loaded")
    }

    if (goldfinchProtocol) {
      loadTranchedPools(goldfinchProtocol)
    }
  }, [goldfinchProtocol])

  return { tranchedPools, status }
}

function Earn(props) {
  const { pool, usdc, user, goldfinchProtocol } = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>()
  const [poolData, setPoolData] = useState<PoolData>()
  const { tranchedPools, status: tranchedPoolsStatus } = useTranchedPools({ goldfinchProtocol })

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
      <div className="pools">
        <PoolList title="Senior Pool">
          <SeniorPoolCard
            balance={displayDollars(usdcFromAtomic(poolData?.totalPoolAssets))}
            userBalance={displayDollars(capitalProvider?.availableToWithdrawInDollars)}
            apy={displayPercent(poolData?.estimatedApy)}
          />
        </PoolList>
        <PoolList title="Junior Pools">
          {tranchedPoolsStatus === "loading"
            ? "Loading..."
            : tranchedPools.map(p => <TranchedPoolCard tranchedPool={p} />)}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
