import {useState, useEffect, useContext} from "react"
import {useHistory} from "react-router-dom"
import {CapitalProvider, fetchCapitalProviderData, PoolData, SeniorPool} from "../ethereum/pool"
import {AppContext} from "../App"
import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {displayDollars, displayPercent, roundDownPenny} from "../utils"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {PoolCreated} from "../typechain/web3/GoldfinchFactory"
import BigNumber from "bignumber.js"
import {User} from "../ethereum/user"

// Filter out 0 limit (inactive) and test pools
const MIN_POOL_LIMIT = usdcToAtomic(process.env.REACT_APP_POOL_FILTER_LIMIT || "200")

function PoolList({title, children}) {
  return (
    <div className="pools-list table-spaced background-container">
      <div className="table-header background-container-inner">
        <div className="table-cell col40 title">{title}</div>
        <div className="table-cell col22 numeric balance">Your Balance</div>
        <div className="table-cell col22 numeric limit">Pool Limit</div>
        <div className="table-cell col16 numeric apy">Est. APY</div>
      </div>
      {children}
    </div>
  )
}

function PortfolioOverview({
  poolData,
  capitalProvider,
  poolBackers,
}: {
  poolData?: PoolData
  capitalProvider?: CapitalProvider
  poolBackers?: PoolBacker[]
}) {
  if (!poolData?.loaded || !capitalProvider?.loaded || !poolBackers) {
    return <></>
  }

  let totalBalance = capitalProvider.availableToWithdrawInDollars
  let totalUnrealizedGains = capitalProvider.unrealizedGainsInDollars
  let estimatedAnnualGrowth = capitalProvider.availableToWithdrawInDollars.multipliedBy(poolData.estimatedApy)
  poolBackers.forEach((p) => {
    totalBalance = totalBalance.plus(p.balanceInDollars)
    totalUnrealizedGains = totalUnrealizedGains.plus(p.unrealizedGainsInDollars)
    const estimatedJuniorApy = p.tranchedPool.estimateJuniorAPY(p.tranchedPool.estimatedLeverageRatio)
    estimatedAnnualGrowth = estimatedAnnualGrowth.plus(p.balanceInDollars.multipliedBy(estimatedJuniorApy))
  })
  let unrealizedAPY = totalUnrealizedGains.dividedBy(totalBalance)
  let estimatedAPY = estimatedAnnualGrowth.dividedBy(totalBalance)

  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value">{displayDollars(totalBalance)}</div>
          <div className="sub-value">
            {displayDollars(roundDownPenny(totalUnrealizedGains))} ({displayPercent(unrealizedAPY)})
          </div>
        </div>
        <div className="deposit-status-item">
          <div className="label">Est. Annual Growth</div>
          <div className="value">{displayDollars(roundDownPenny(estimatedAnnualGrowth))}</div>
          <div className="sub-value">{`${displayPercent(estimatedAPY)} APY`}</div>
        </div>
      </div>
    </div>
  )
}

function SeniorPoolCard({balance, userBalance, apy, limit}) {
  const history = useHistory()

  return (
    <div
      key="senior-pool"
      className="table-row background-container-inner clickable"
      onClick={() => history.push("/pools/senior")}
    >
      <div className="table-cell col40">
        {balance}
        <span className="subheader">Total Pool Balance</span>
      </div>
      <div className="table-cell col22 numeric balance">{userBalance}</div>
      <div className="table-cell col22 numeric limit">{limit}</div>
      <div className="table-cell col16 numeric apy">{apy}</div>
    </div>
  )
}

function TranchedPoolCard({poolBacker}: {poolBacker: PoolBacker}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  let estimatedApy = new BigNumber(NaN)
  let disabledClass = ""
  if (leverageRatio) {
    estimatedApy = tranchedPool.estimateJuniorAPY(leverageRatio)
  }

  if (poolBacker?.tokenInfos.length === 0) {
    disabledClass = "disabled"
  }

  return (
    <div
      className="table-row background-container-inner clickable"
      onClick={() => history.push(`/pools/${tranchedPool.address}`)}
    >
      <div className="table-cell col40 pool-info">
        <img className={"icon"} src={tranchedPool.metadata?.icon} alt="pool-icon" />
        <div className="name">
          <span>{tranchedPool.displayName}</span>
          <span className="subheader">{tranchedPool.metadata?.category}</span>
        </div>
      </div>
      <div className={`${disabledClass} table-cell col22 numeric balance`}>
        {displayDollars(poolBacker?.balanceInDollars)}
      </div>
      <div className="table-cell col22 numeric limit">{displayDollars(limit, 0)}</div>
      <div className="table-cell col16 numeric apy">{displayPercent(estimatedApy)}</div>
    </div>
  )
}

function usePoolBackers({goldfinchProtocol, user}: {goldfinchProtocol?: GoldfinchProtocol; user?: User}): {
  backers: PoolBacker[]
  status: string
} {
  let [backers, setBackers] = useState<PoolBacker[]>([])
  let [status, setStatus] = useState<string>("loading")

  useEffect(() => {
    async function loadTranchedPools(goldfinchProtocol: GoldfinchProtocol, user: User) {
      let poolEvents = (await goldfinchProtocol.queryEvents("GoldfinchFactory", [
        "PoolCreated",
      ])) as unknown as PoolCreated[]
      let poolAddresses = poolEvents.map((e) => e.returnValues.pool)
      let tranchedPools = poolAddresses.map((a) => new TranchedPool(a, goldfinchProtocol))
      await Promise.all(tranchedPools.map((p) => p.initialize()))
      tranchedPools = tranchedPools.filter((p) => p.metadata)
      const activePoolBackers = tranchedPools
        .filter((p) => p.creditLine.limit.gte(MIN_POOL_LIMIT))
        .map((p) => new PoolBacker(user.address, p, goldfinchProtocol))
      await Promise.all(activePoolBackers.map((b) => b.initialize()))
      setBackers(
        activePoolBackers.sort(
          (a, b) =>
            // Primary sort: ascending by tranched pool status (Open -> JuniorLocked -> ...)
            a.tranchedPool.state - b.tranchedPool.state ||
            // Secondary sort: descending by user's balance
            b.balanceInDollars.comparedTo(a.balanceInDollars) ||
            // Tertiary sort: alphabetical by display name, for the sake of stable ordering.
            a.tranchedPool.displayName.localeCompare(b.tranchedPool.displayName),
        ),
      )
      setStatus("loaded")
    }

    if (goldfinchProtocol && user) {
      loadTranchedPools(goldfinchProtocol, user)
    }
  }, [goldfinchProtocol, user])

  return {backers, status}
}

function Earn(props) {
  const {pool, usdc, user, goldfinchProtocol, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>()
  const {backers, status: tranchedPoolsStatus} = usePoolBackers({goldfinchProtocol, user})

  useEffect(() => {
    if (pool) {
      const capitalProviderAddress = user.loaded && user.address

      refreshCapitalProviderData(pool, capitalProviderAddress)
    }
  }, [pool, usdc, user])

  async function refreshCapitalProviderData(pool: SeniorPool, address: string | boolean) {
    const capitalProvider = await fetchCapitalProviderData(pool, address)
    setCapitalProvider(capitalProvider)
  }

  let earnMessage = "Loading..."
  if (capitalProvider?.loaded || user.noWeb3) {
    earnMessage = "Pools"
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <div>{earnMessage}</div>
      </div>
      <PortfolioOverview poolData={pool?.gf} capitalProvider={capitalProvider} poolBackers={backers} />
      <div className="pools">
        <PoolList title="Senior Pool">
          <SeniorPoolCard
            balance={displayDollars(usdcFromAtomic(pool?.gf.totalPoolAssets))}
            userBalance={displayDollars(capitalProvider?.availableToWithdrawInDollars)}
            apy={displayPercent(pool?.gf.estimatedApy)}
            limit={displayDollars(usdcFromAtomic(goldfinchConfig?.totalFundsLimit), 0)}
          />
        </PoolList>
        <PoolList title="Borrower Pools">
          {tranchedPoolsStatus === "loading"
            ? "Loading..."
            : backers.map((p) => <TranchedPoolCard key={`${p.tranchedPool.address}`} poolBacker={p} />)}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
