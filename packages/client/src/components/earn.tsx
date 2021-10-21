import {useState, useEffect, useContext} from "react"
import {useHistory} from "react-router-dom"
import {CapitalProvider, fetchCapitalProviderData, PoolData, SeniorPool, StakingRewards} from "../ethereum/pool"
import {AppContext} from "../App"
import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {displayDollars, displayPercent, roundDownPenny} from "../utils"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {PoolCreated} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchFactory"
import BigNumber from "bignumber.js"
import {User} from "../ethereum/user"
import ConnectionNotice from "./connectionNotice"
import Badge from "./badge"
import {InfoIcon} from "../ui/icons"
import {useStakingRewards} from "../hooks/useStakingRewards"
import AnnualGrowthTooltipContent from "./AnnualGrowthTooltipContent"

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

function PortfolioOverviewSkeleton() {
  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value disabled">$--.--</div>
          <div className="sub-value disabled">--.-- (--.--%)</div>
        </div>
        <div className="deposit-status-item">
          <div className="label">Est. Annual Growth</div>

          <div className="value disabled">$--.--</div>
          <div className="sub-value disabled">--.--% APY</div>
        </div>
      </div>
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

  const globalEstimatedApyFromSupplying = poolData.estimatedApy

  let totalBalance = capitalProvider.totalSeniorPoolBalanceInDollars
  let totalUnrealizedGains = capitalProvider.unrealizedGainsInDollars
  let estimatedAnnualGrowth = totalBalance.multipliedBy(globalEstimatedApyFromSupplying)
  poolBackers.forEach((p) => {
    totalBalance = totalBalance.plus(p.balanceInDollars)
    totalUnrealizedGains = totalUnrealizedGains.plus(p.unrealizedGainsInDollars)
    const estimatedJuniorApy = p.tranchedPool.estimateJuniorAPY(p.tranchedPool.estimatedLeverageRatio)
    estimatedAnnualGrowth = estimatedAnnualGrowth.plus(p.balanceInDollars.multipliedBy(estimatedJuniorApy))
  })

  const userEstimatedApyFromSupplying = estimatedAnnualGrowth.dividedBy(totalBalance)
  const estimatedApyFromSupplying = totalBalance.gt(0) ? userEstimatedApyFromSupplying : globalEstimatedApyFromSupplying

  const globalEstimatedApyFromGfi = poolData.estimatedApyFromGfi || new BigNumber(0)
  // NOTE: Same comment applies here as in `DepositStatus()` in `components/depositStatus`, that
  // we do not worry about adjusting `userEstimatedApyFromGfi` here for a boosted reward rate the user
  // would receive from having staked-with-lockup. The frontend does not currently support staking
  // with lockup, so we punt on that subtlety.
  const balancePortionEarningGfi = capitalProvider.stakedSeniorPoolBalanceInDollars.div(totalBalance)
  const userEstimatedApyFromGfi = balancePortionEarningGfi.multipliedBy(globalEstimatedApyFromGfi)
  const estimatedApyFromGfi = totalBalance.gt(0) ? userEstimatedApyFromGfi : globalEstimatedApyFromGfi

  const estimatedApy = estimatedApyFromSupplying.plus(estimatedApyFromGfi)

  const unrealizedGainsPercent = totalUnrealizedGains.dividedBy(totalBalance)
  const displayUnrealizedGains = capitalProvider.empty ? null : roundDownPenny(totalUnrealizedGains)

  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value">{displayDollars(totalBalance)}</div>
          <div className="sub-value">
            {displayDollars(displayUnrealizedGains)} ({displayPercent(unrealizedGainsPercent)})
          </div>
        </div>
        <div className="deposit-status-item">
          <div className="deposit-status-item-flex">
            <div className="label">Est. Annual Growth</div>
            <span data-tip="" data-for="annual-growth-tooltip" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
              <InfoIcon />
            </span>
          </div>
          <div className="value">{displayDollars(roundDownPenny(estimatedAnnualGrowth))}</div>
          <div className="sub-value">{`${displayPercent(estimatedApy)} APY${
            estimatedApyFromGfi.gt(0) ? " (with GFI)" : ""
          }`}</div>
        </div>
      </div>
      <AnnualGrowthTooltipContent
        supplyingCombined={true}
        estimatedApyFromSupplying={estimatedApyFromSupplying}
        estimatedApyFromGfi={estimatedApyFromGfi}
        estimatedApy={estimatedApy}
      />
    </div>
  )
}

function SeniorPoolCardSkeleton() {
  return (
    <div key="senior-pool" className="table-row background-container-inner clickable">
      <div className="table-cell col40 disabled">
        $--.--
        <span className="subheader">Total Pool Balance</span>
      </div>
      <div className="table-cell col22 numeric balance disabled">$--.--</div>
      <div className="table-cell col22 numeric limit disabled">$--.--</div>
      <div className="table-cell col16 numeric apy disabled">$--.--%</div>
    </div>
  )
}

export function SeniorPoolCard({balance, userBalance, apy, limit, remainingCapacity}) {
  const history = useHistory()

  return (
    <div
      key="senior-pool"
      className="table-row background-container-inner clickable pool-card"
      onClick={() => history.push("/pools/senior")}
    >
      <div className="table-cell col40">
        {balance}
        <span className="subheader">Total Pool Balance</span>
      </div>
      <div className="table-cell col22 numeric balance">{userBalance}</div>
      <div className="table-cell col22 numeric limit">{limit}</div>
      <div className="table-cell col16 numeric apy">{apy}</div>
      <div className="pool-capacity">
        {remainingCapacity?.isZero() ? (
          <Badge text="Full" variant="gray" fixedWidth />
        ) : (
          <Badge text="Open" variant="blue" fixedWidth />
        )}
      </div>
    </div>
  )
}

function TranchedPoolCardSkeleton() {
  return (
    <div className="table-row background-container-inner clickable">
      <div className="table-cell col40 pool-info fallback-content">
        <div className="circle-icon" />
        <div className="name">
          <span>Loading...</span>
        </div>
      </div>
      <div className="disabled table-cell col22 numeric balance">$--.--</div>
      <div className="disabled table-cell col22 numeric limit">$--.--</div>
      <div className="disabled table-cell col16 numeric apy">--.--%</div>
    </div>
  )
}

export function TranchedPoolCard({poolBacker}: {poolBacker: PoolBacker}) {
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
      className="table-row background-container-inner clickable pool-card"
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
      <div className="pool-capacity">
        {tranchedPool.remainingCapacity().isZero() ? (
          <Badge text="Full" variant="gray" fixedWidth />
        ) : (
          <Badge text="Open" variant="blue" fixedWidth />
        )}
      </div>
    </div>
  )
}

function usePoolBackers({goldfinchProtocol, user}: {goldfinchProtocol?: GoldfinchProtocol; user?: User}): {
  backers: PoolBacker[]
  backersStatus: string
  poolsAddresses: string[]
  poolsAddressesStatus: string
} {
  let [backers, setBackers] = useState<PoolBacker[]>([])
  let [backersStatus, setBackersStatus] = useState<string>("loading")
  const [poolsAddresses, setPoolsAddresses] = useState<string[]>([])
  const [poolsAddressesStatus, setPoolsAddressesStatus] = useState<string>("loading")

  useEffect(() => {
    async function loadTranchedPools(goldfinchProtocol: GoldfinchProtocol, user: User) {
      let poolEvents = (await goldfinchProtocol.queryEvents("GoldfinchFactory", [
        "PoolCreated",
      ])) as unknown as PoolCreated[]
      let poolAddresses = poolEvents.map((e) => e.returnValues.pool)
      setPoolsAddresses(poolAddresses)
      setPoolsAddressesStatus("loaded")
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
            a.tranchedPool.displayName.localeCompare(b.tranchedPool.displayName)
        )
      )
      setBackersStatus("loaded")
    }

    if (goldfinchProtocol && user) {
      loadTranchedPools(goldfinchProtocol, user)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, user])

  return {backers, backersStatus, poolsAddresses, poolsAddressesStatus}
}

function Earn() {
  const {pool, usdc, user, goldfinchProtocol, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>()
  const {
    backers,
    backersStatus: tranchedPoolsStatus,
    poolsAddresses,
    poolsAddressesStatus,
  } = usePoolBackers({goldfinchProtocol, user})
  const stakingRewards = useStakingRewards()

  useEffect(() => {
    if (pool) {
      const capitalProviderAddress: string | undefined = user.loaded ? user.address : undefined

      refreshCapitalProviderData(pool, stakingRewards, capitalProviderAddress)
    }
  }, [pool, stakingRewards, usdc, user])

  async function refreshCapitalProviderData(
    pool: SeniorPool,
    stakingRewards: StakingRewards | undefined,
    address: string | undefined
  ) {
    const capitalProvider = await fetchCapitalProviderData(pool, stakingRewards, address)
    setCapitalProvider(capitalProvider)
  }

  const isLoading = !(capitalProvider?.loaded || user.noWeb3)
  const earnMessage = isLoading ? "Loading..." : "Pools"

  return (
    <div className="content-section">
      <div className="page-header">
        <div>{earnMessage}</div>
      </div>
      {isLoading ? (
        <PortfolioOverviewSkeleton />
      ) : (
        <>
          <ConnectionNotice />
          <PortfolioOverview poolData={pool?.gf} capitalProvider={capitalProvider} poolBackers={backers} />
        </>
      )}
      <div className="pools">
        <PoolList title="Senior Pool">
          {isLoading ? (
            <SeniorPoolCardSkeleton />
          ) : (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(pool?.gf.totalPoolAssets))}
              userBalance={displayDollars(capitalProvider?.availableToWithdrawInDollars)}
              apy={displayPercent(pool?.gf.estimatedApy)}
              limit={displayDollars(usdcFromAtomic(goldfinchConfig?.totalFundsLimit), 0)}
              remainingCapacity={pool?.gf.remainingCapacity(goldfinchConfig?.totalFundsLimit)}
            />
          )}
        </PoolList>
        <PoolList title="Borrower Pools">
          {tranchedPoolsStatus === "loading" && poolsAddressesStatus === "loading" && (
            <>
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
            </>
          )}

          {tranchedPoolsStatus === "loading" && poolsAddresses.map((a) => <TranchedPoolCardSkeleton key={a} />)}

          {tranchedPoolsStatus !== "loading" &&
            backers.map((p) => <TranchedPoolCard key={`${p.tranchedPool.address}`} poolBacker={p} />)}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
