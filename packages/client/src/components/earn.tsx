import {PoolCreated} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchFactory"
import BigNumber from "bignumber.js"
import React, {useContext, useEffect, useState} from "react"
import {useHistory} from "react-router-dom"
import {AppContext} from "../App"
import {useEarn} from "../contexts/EarnContext"
import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {GFILoaded} from "../ethereum/gfi"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  PoolData,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../ethereum/pool"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {User, UserLoaded} from "../ethereum/user"
import {Loadable, Loaded} from "../types/loadable"
import {InfoIcon} from "../ui/icons"
import {BlockInfo, displayDollars, displayPercent, roundDownPenny} from "../utils"
import AnnualGrowthTooltipContent from "./AnnualGrowthTooltipContent"
import Badge from "./badge"
import ConnectionNotice from "./connectionNotice"

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
  poolData: PoolData | undefined
  capitalProvider: Loaded<CapitalProvider>
  poolBackers: Loaded<PoolBacker[]>
}) {
  const loaded = poolData && capitalProvider.loaded && poolBackers.loaded
  if (!loaded) {
    return <></>
  }

  const globalEstimatedApyFromSupplying = poolData.estimatedApy

  let totalBalance = capitalProvider.value.totalSeniorPoolBalanceInDollars
  let totalUnrealizedGains = capitalProvider.value.unrealizedGainsInDollars
  let estimatedAnnualGrowth = totalBalance.multipliedBy(globalEstimatedApyFromSupplying)
  poolBackers.value.forEach((p) => {
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
  const balancePortionEarningGfi = capitalProvider.value.stakedSeniorPoolBalanceInDollars.div(totalBalance)
  const userEstimatedApyFromGfi = balancePortionEarningGfi.multipliedBy(globalEstimatedApyFromGfi)
  const estimatedApyFromGfi = totalBalance.gt(0) ? userEstimatedApyFromGfi : globalEstimatedApyFromGfi

  const estimatedApy = estimatedApyFromSupplying.plus(estimatedApyFromGfi)

  const unrealizedGainsPercent = totalUnrealizedGains.dividedBy(totalBalance)
  const displayUnrealizedGains = roundDownPenny(totalUnrealizedGains)

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

export function TranchedPoolCard({poolBacker, disabled}: {poolBacker: PoolBacker; disabled: boolean}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  let estimatedApy = new BigNumber(NaN)
  if (leverageRatio) {
    estimatedApy = tranchedPool.estimateJuniorAPY(leverageRatio)
  }

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.tokenInfos.length === 0 ? "disabled" : ""

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

function usePoolBackers({
  goldfinchProtocol,
  user,
  currentBlock,
}: {
  goldfinchProtocol: GoldfinchProtocol | undefined
  user: User | undefined
  currentBlock: BlockInfo | undefined
}): {
  backers: Loadable<PoolBacker[]>
  poolsAddresses: Loadable<string[]>
} {
  let [backers, setBackers] = useState<Loadable<PoolBacker[]>>({
    loaded: false,
    value: undefined,
  })
  const [poolsAddresses, setPoolsAddresses] = useState<Loadable<string[]>>({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    async function loadTranchedPools(goldfinchProtocol: GoldfinchProtocol, user: User, currentBlock: BlockInfo) {
      let poolEvents = (await goldfinchProtocol.queryEvents(
        "GoldfinchFactory",
        ["PoolCreated"],
        undefined,
        currentBlock.number
      )) as unknown as PoolCreated[]
      let poolAddresses = poolEvents.map((e) => e.returnValues.pool)
      setPoolsAddresses({
        loaded: true,
        value: poolAddresses,
      })
      let tranchedPools = poolAddresses.map((a) => new TranchedPool(a, goldfinchProtocol))
      await Promise.all(tranchedPools.map((p) => p.initialize(currentBlock)))
      tranchedPools = tranchedPools.filter((p) => p.metadata)
      const activePoolBackers = tranchedPools
        .filter((p) => p.creditLine.limit.gte(MIN_POOL_LIMIT))
        .map((p) => new PoolBacker(user.address, p, goldfinchProtocol))
      await Promise.all(activePoolBackers.map((b) => b.initialize(currentBlock)))
      setBackers({
        loaded: true,
        value: activePoolBackers.sort(
          (a, b) =>
            // Primary sort: ascending by tranched pool status (Open -> JuniorLocked -> ...)
            a.tranchedPool.state - b.tranchedPool.state ||
            // Secondary sort: descending by user's balance
            b.balanceInDollars.comparedTo(a.balanceInDollars) ||
            // Tertiary sort: alphabetical by display name, for the sake of stable ordering.
            a.tranchedPool.displayName.localeCompare(b.tranchedPool.displayName)
        ),
      })
    }

    if (goldfinchProtocol && user && currentBlock) {
      loadTranchedPools(goldfinchProtocol, user, currentBlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, user, currentBlock])

  return {backers, poolsAddresses}
}

function Earn() {
  const {pool, usdc, user, goldfinchProtocol, goldfinchConfig, stakingRewards, gfi, currentBlock} =
    useContext(AppContext)
  const {earnStore, setEarnStore} = useEarn()
  const [capitalProvider, setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const {backers, poolsAddresses} = usePoolBackers({goldfinchProtocol, user, currentBlock})

  useEffect(() => {
    if (pool && stakingRewards && gfi && user) {
      refreshCapitalProviderData(pool, stakingRewards, gfi, user)
    }
  }, [pool, stakingRewards, gfi, usdc, user])

  async function refreshCapitalProviderData(
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    gfi: GFILoaded,
    user: UserLoaded
  ) {
    // TODO Would be ideal to refactor this component so that the child components it renders all
    // receive state that is consistent, i.e. using `pool.poolData`, `capitalProvider` state,
    // `stakingRewards`, `gfi`, and `user` that are guaranteed to be based on the same block number. For now, here
    // we ensure that the derivation of `capitalProvider` state is done using `pool.poolData`,
    // `stakingRewards`, `gfi`, and `user` that are consistent with each other.
    const poolBlockNumber = pool.info.value.currentBlock.number
    const stakingRewardsBlockNumber = stakingRewards.info.value.currentBlock.number
    const gfiBlockNumber = gfi.info.value.currentBlock.number
    const userBlockNumber = user.info.value.currentBlock.number
    if (
      poolBlockNumber === stakingRewardsBlockNumber &&
      poolBlockNumber === gfiBlockNumber &&
      poolBlockNumber === userBlockNumber
    ) {
      const capitalProvider = await fetchCapitalProviderData(pool, stakingRewards, gfi, user)
      setCapitalProvider(capitalProvider)
    }
  }

  useEffect(() => {
    setEarnStore({
      capitalProvider,
      backers,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalProvider, backers])

  const capitalProviderData = earnStore.capitalProvider
  const backersData = earnStore.backers

  const isLoading = !pool || !capitalProviderData.loaded || !backersData.loaded || !user || user.noWeb3
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
          <ConnectionNotice requireUnlock={false} />
          <PortfolioOverview
            poolData={pool.info.value.poolData}
            capitalProvider={capitalProviderData}
            poolBackers={backersData}
          />
        </>
      )}
      <div className="pools">
        <PoolList title="Senior Pool">
          {isLoading ? (
            <SeniorPoolCardSkeleton />
          ) : (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(pool.info.value.poolData.totalPoolAssets))}
              userBalance={displayDollars(capitalProviderData.value.availableToWithdrawInDollars)}
              apy={displayPercent(pool.info.value.poolData.estimatedApy)}
              limit={displayDollars(goldfinchConfig ? usdcFromAtomic(goldfinchConfig.totalFundsLimit) : undefined, 0)}
              remainingCapacity={
                goldfinchConfig
                  ? pool.info.value.poolData.remainingCapacity(goldfinchConfig.totalFundsLimit)
                  : undefined
              }
            />
          )}
        </PoolList>
        <PoolList title="Borrower Pools">
          {!poolsAddresses.loaded && !backersData.loaded && (
            <>
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
            </>
          )}

          {poolsAddresses.loaded &&
            !backersData.loaded &&
            poolsAddresses.value.map((a) => <TranchedPoolCardSkeleton key={a} />)}

          {backersData.loaded &&
            backersData.value.map((p) => (
              <TranchedPoolCard key={`${p.tranchedPool.address}`} poolBacker={p} disabled={isLoading} />
            ))}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
