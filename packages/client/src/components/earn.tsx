import React, {useState, useEffect, useContext} from "react"
import {useHistory} from "react-router-dom"
import {CapitalProvider, fetchCapitalProviderData, PoolData, SeniorPool} from "../ethereum/pool"
import {AppContext, ParticipantsByTranchedPoolAddress} from "../App"
import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {displayDollars, displayPercent, roundDownPenny} from "../utils"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {PoolCreated} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchFactory"
import BigNumber from "bignumber.js"
import {User} from "../ethereum/user"
import ConnectionNotice from "./connectionNotice"
import {useEarn} from "../contexts/EarnContext"
import Badge from "./badge"
import isUndefined from "lodash/isUndefined"
import compact from "lodash/compact"
import fromPairs from "lodash/fromPairs"

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
  const displayUnrealizedGains = capitalProvider.empty ? null : roundDownPenny(totalUnrealizedGains)

  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value">{displayDollars(totalBalance)}</div>
          <div className="sub-value">
            {displayDollars(displayUnrealizedGains)} ({displayPercent(unrealizedAPY)})
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

export function TranchedPoolCard({
  poolBacker,
  participants,
  disabled,
}: {
  poolBacker: PoolBacker
  participants: string[] | undefined
  disabled: boolean
}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  const estimatedApy = leverageRatio ? tranchedPool.estimateJuniorAPY(leverageRatio) : new BigNumber(NaN)

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.tokenInfos.length === 0 ? "disabled" : ""
  const isFull = tranchedPool.getIsFull(poolBacker.address, participants)
  const badge = isUndefined(isFull) ? undefined : isFull ? (
    <Badge text="Full" variant="gray" fixedWidth />
  ) : (
    <Badge text="Open" variant="blue" fixedWidth />
  )

  return (
    <div
      className="table-row background-container-inner clickable pool-card"
      onClick={() => history.push(`/pools/${tranchedPool.address}`)}
    >
      <div className={`table-cell col40 pool-info ${disabledClass}`}>
        <img className={`icon ${disabledClass}`} src={tranchedPool.metadata?.icon} alt="pool-icon" />
        <div className="name">
          <span>{tranchedPool.displayName}</span>
          <span className={`subheader ${disabledClass}`}>{tranchedPool.metadata?.category}</span>
        </div>
      </div>
      <div className={`${balanceDisabledClass} ${disabledClass} table-cell col22 numeric balance`}>
        {displayDollars(poolBacker?.balanceInDollars)}
      </div>
      <div className={`table-cell col22 numeric limit ${disabledClass}`}>{displayDollars(limit, 0)}</div>
      <div className={`table-cell col16 numeric apy ${disabledClass}`}>{displayPercent(estimatedApy)}</div>
      <div className="pool-capacity">{badge}</div>
    </div>
  )
}

function usePoolBackers({
  goldfinchProtocol,
  user,
  participantsByTranchedPoolAddress,
  setParticipantsByTranchedPoolAddress,
}: {
  goldfinchProtocol?: GoldfinchProtocol
  user?: User
  participantsByTranchedPoolAddress?: ParticipantsByTranchedPoolAddress
  setParticipantsByTranchedPoolAddress?: (newVal: ParticipantsByTranchedPoolAddress) => void
}): {
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
    async function loadTranchedPools(
      goldfinchProtocol: GoldfinchProtocol,
      user: User,
      participantsByTranchedPoolAddress: ParticipantsByTranchedPoolAddress,
      setParticipantsByTranchedPoolAddress: (newVal: ParticipantsByTranchedPoolAddress) => void
    ) {
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

      const participantsByActivePoolAddress = fromPairs(
        compact(
          await Promise.all(
            activePoolBackers.map((b) =>
              b.tranchedPool.participationLimits
                ? b.tranchedPool.getParticipants().then((participants) => [b.tranchedPool.address, participants])
                : undefined
            )
          )
        )
      )
      setParticipantsByTranchedPoolAddress({
        ...participantsByTranchedPoolAddress,
        ...participantsByActivePoolAddress,
      })
    }

    if (goldfinchProtocol && user && participantsByTranchedPoolAddress && setParticipantsByTranchedPoolAddress) {
      loadTranchedPools(
        goldfinchProtocol,
        user,
        participantsByTranchedPoolAddress,
        setParticipantsByTranchedPoolAddress
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, user])

  return {backers, backersStatus, poolsAddresses, poolsAddressesStatus}
}

function Earn() {
  const {
    pool,
    usdc,
    user,
    goldfinchProtocol,
    goldfinchConfig,
    participantsByTranchedPoolAddress,
    setParticipantsByTranchedPoolAddress,
  } = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>()
  const {
    backers,
    backersStatus: tranchedPoolsStatus,
    poolsAddresses,
    poolsAddressesStatus,
  } = usePoolBackers({
    goldfinchProtocol,
    user,
    participantsByTranchedPoolAddress,
    setParticipantsByTranchedPoolAddress,
  })
  const {earnStore, setEarnStore} = useEarn()

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

  useEffect(() => {
    if (capitalProvider?.loaded) {
      setEarnStore({...earnStore, capitalProvider})
    }
    if (backers.length > 0) {
      setEarnStore({...earnStore, backers})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalProvider, backers])

  const capitalProviderData = earnStore.capitalProvider
  const backersData = earnStore.backers
  const tranchedPoolsStatusData = earnStore.backers.length > 0 ? "loaded" : tranchedPoolsStatus

  const disabled = !capitalProvider?.loaded || !(backers.length > 0)

  const isLoading = !(capitalProviderData?.loaded || user.noWeb3)
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
          <PortfolioOverview poolData={pool?.gf} capitalProvider={capitalProviderData} poolBackers={backersData} />
        </>
      )}
      <div className="pools">
        <PoolList title="Senior Pool">
          {isLoading ? (
            <SeniorPoolCardSkeleton />
          ) : (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(pool?.gf.totalPoolAssets))}
              userBalance={displayDollars(capitalProviderData?.availableToWithdrawInDollars)}
              apy={displayPercent(pool?.gf.estimatedApy)}
              limit={displayDollars(usdcFromAtomic(goldfinchConfig?.totalFundsLimit), 0)}
              remainingCapacity={pool?.gf.remainingCapacity(goldfinchConfig?.totalFundsLimit)}
            />
          )}
        </PoolList>
        <PoolList title="Borrower Pools">
          {tranchedPoolsStatusData === "loading" && poolsAddressesStatus === "loading" && (
            <>
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
            </>
          )}

          {tranchedPoolsStatusData === "loading" && poolsAddresses.map((a) => <TranchedPoolCardSkeleton key={a} />)}

          {tranchedPoolsStatusData !== "loading" &&
            backersData.map((p) => (
              <TranchedPoolCard
                key={`${p.tranchedPool.address}`}
                poolBacker={p}
                participants={participantsByTranchedPoolAddress?.[p.tranchedPool.address]}
                disabled={disabled}
              />
            ))}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
