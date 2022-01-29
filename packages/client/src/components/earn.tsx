import BigNumber from "bignumber.js"
import React, {useContext, useEffect, useState} from "react"
import {useHistory} from "react-router-dom"
import {AppContext} from "../App"
import {useEarn} from "../contexts/EarnContext"
import {usdcFromAtomic} from "../ethereum/erc20"
import {GFI, GFILoaded} from "../ethereum/gfi"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  PoolData,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../ethereum/pool"
import {PoolBacker} from "../ethereum/tranchedPool"
import {UserLoaded} from "../ethereum/user"
import {Loadable, Loaded} from "../types/loadable"
import {InfoIcon} from "../ui/icons"
import {assertNonNullable, displayDollars, displayPercent, roundDownPenny} from "../utils"
import AnnualGrowthTooltipContent from "./AnnualGrowthTooltipContent"
import Badge from "./badge"
import ConnectionNotice from "./connectionNotice"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {ONE_QUADRILLION_USDC} from "../ethereum/utils"

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

export function PortfolioOverview({
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

  const globalEstimatedApyFromGfi = poolData.estimatedApyFromGfi
  const estimatedApyFromGfi = GFI.estimateApyFromGfi(
    capitalProvider.value.stakedSeniorPoolBalanceInDollars,
    totalBalance,
    globalEstimatedApyFromGfi
  )
  const estimatedApy = estimatedApyFromGfi
    ? estimatedApyFromSupplying.plus(estimatedApyFromGfi)
    : estimatedApyFromSupplying

  const unrealizedGainsPercent = totalUnrealizedGains.dividedBy(totalBalance)
  const displayUnrealizedGains = roundDownPenny(totalUnrealizedGains)
  const toggleRewards = process.env.REACT_APP_TOGGLE_REWARDS === "true"

  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value" data-testid="portfolio-total-balance">
            {displayDollars(totalBalance)}
          </div>
          <div className="sub-value" data-testid="portfolio-total-balance-perc">
            {displayDollars(displayUnrealizedGains)} ({displayPercent(unrealizedGainsPercent)})
          </div>
        </div>
        <div className="deposit-status-item">
          <div className="deposit-status-item-flex">
            <div className="label">Est. Annual Growth</div>
            {toggleRewards && (
              <span
                data-tip=""
                data-for="annual-growth-tooltip"
                data-offset="{'top': 0, 'left': 0}"
                data-place="bottom"
              >
                <InfoIcon />
              </span>
            )}
          </div>
          <div className="value" data-testid="portfolio-est-growth">
            {displayDollars(roundDownPenny(estimatedAnnualGrowth))}
          </div>
          <div className="sub-value" data-testid="portfolio-est-growth-perc">{`${displayPercent(estimatedApy)} APY${
            toggleRewards && estimatedApyFromGfi && estimatedApyFromGfi.gt(0) ? " (with GFI)" : ""
          }`}</div>
        </div>
      </div>
      {toggleRewards && (
        <AnnualGrowthTooltipContent
          supplyingCombined={true}
          estimatedApyFromSupplying={estimatedApyFromSupplying}
          estimatedApyFromGfi={estimatedApyFromGfi}
          estimatedApy={estimatedApy}
        />
      )}
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

export type SeniorPoolStatus = {
  totalPoolAssets: BigNumber
  availableToWithdrawInDollars: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  totalFundsLimit: BigNumber | undefined
  remainingCapacity: BigNumber | undefined
}

type SeniorPoolCardProps = {
  balance: string
  userBalance: string
  apy: string
  limit: string
  remainingCapacity: BigNumber | undefined
  disabled: boolean
  userBalanceDisabled: boolean
}

export function SeniorPoolCard(props: SeniorPoolCardProps) {
  const disabledClass = props.disabled ? "disabled" : ""
  const userBalanceDisabledClass = props.userBalanceDisabled ? "disabled" : ""
  const history = useHistory()
  return (
    <div
      key="senior-pool"
      className={`table-row background-container-inner clickable pool-card ${disabledClass}`}
      onClick={() => history.push("/pools/senior")}
    >
      <div className="table-cell col40">
        {props.balance}
        <span className={`subheader ${disabledClass}`}>Total Pool Balance</span>
      </div>
      <div className={`table-cell col22 numeric balance ${userBalanceDisabledClass}`}>{props.userBalance}</div>
      <div className="table-cell col22 numeric limit">{props.limit}</div>
      <div className="table-cell col16 numeric apy">{props.apy}</div>
      <div className="pool-capacity">
        {props.remainingCapacity?.isZero() ? (
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

  const estimatedApy = leverageRatio ? tranchedPool.estimateJuniorAPY(leverageRatio) : new BigNumber(NaN)

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.tokenInfos.length === 0 ? "disabled" : ""
  const badge = tranchedPool.isPaused ? (
    <Badge text="Paused" variant="gray" fixedWidth={false} />
  ) : tranchedPool.isFull ? (
    <Badge text="Full" variant="gray" fixedWidth={true} />
  ) : (
    <Badge text="Open" variant="blue" fixedWidth={true} />
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
        {poolBacker.address ? displayDollars(poolBacker?.balanceInDollars) : displayDollars(undefined)}
      </div>
      <div className={`table-cell col22 numeric limit ${disabledClass}`}>{displayDollars(limit, 0)}</div>
      <div className={`table-cell col16 numeric apy ${disabledClass}`}>{displayPercent(estimatedApy)}</div>
      <div className="pool-capacity">{badge}</div>
    </div>
  )
}

function Earn() {
  const {userWalletWeb3Status, pool, usdc, user, stakingRewards, gfi, setLeafCurrentBlock} = useContext(AppContext)
  const {earnStore, setEarnStore} = useEarn()
  const [capitalProvider, setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const {backers: backersData, seniorPoolStatus, poolsAddresses, capitalProvider: capitalProviderData} = earnStore
  const currentRoute = useCurrentRoute()

  useEffect(() => {
    setEarnStore({
      ...earnStore,
      capitalProvider,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalProvider])

  useEffect(() => {
    if (pool && stakingRewards && gfi && user) {
      refreshCapitalProviderData(pool, stakingRewards, gfi, user)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, stakingRewards, gfi, usdc, user])

  async function refreshCapitalProviderData(
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    gfi: GFILoaded,
    user: UserLoaded
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    // To ensure `pool`, `stakingRewards`, `gfi`, `user`, and `capitalProvider` are from
    // the same block, we'd use `useFromSameBlock()` in this component. But holding off
    // on that due to the decision to abandon https://github.com/warbler-labs/mono/pull/140.
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
      setLeafCurrentBlock(currentRoute, pool.info.value.currentBlock)
    }
  }

  const loaded = pool && backersData.loaded
  const earnMessage = userWalletWeb3Status?.type === "no_web3" || loaded ? "Pools" : "Loading..."
  let limitToDisplay: string
  if (seniorPoolStatus.value?.totalFundsLimit?.gte(ONE_QUADRILLION_USDC)) {
    limitToDisplay = "No Limit"
  } else if (seniorPoolStatus.value?.totalFundsLimit) {
    limitToDisplay = displayDollars(usdcFromAtomic(seniorPoolStatus.value.totalFundsLimit), 0)
  } else {
    limitToDisplay = displayDollars(undefined)
  }

  let apyToDisplay
  if (pool?.info.value.poolData.estimatedApyFromGfi && seniorPoolStatus?.value?.estimatedApy) {
    apyToDisplay = pool.info.value.poolData.estimatedApyFromGfi.plus(seniorPoolStatus.value.estimatedApy)
  } else {
    apyToDisplay = seniorPoolStatus.value?.estimatedApy
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <div>{earnMessage}</div>
      </div>
      <ConnectionNotice requireUnlock={false} />
      {userWalletWeb3Status?.type === "no_web3" || !pool || !capitalProviderData.loaded || !backersData.loaded ? (
        <PortfolioOverviewSkeleton />
      ) : (
        <PortfolioOverview
          poolData={pool.info.value.poolData}
          capitalProvider={capitalProviderData}
          poolBackers={backersData}
        />
      )}
      <div className="pools">
        <PoolList title="Senior Pool">
          {seniorPoolStatus.loaded ? (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(seniorPoolStatus.value.totalPoolAssets))}
              userBalance={displayDollars(seniorPoolStatus.value.availableToWithdrawInDollars)}
              apy={displayPercent(apyToDisplay)}
              limit={limitToDisplay}
              remainingCapacity={seniorPoolStatus.value.remainingCapacity}
              disabled={!loaded}
              userBalanceDisabled={!seniorPoolStatus.value.availableToWithdrawInDollars}
            />
          ) : (
            <SeniorPoolCardSkeleton />
          )}
        </PoolList>
        <PoolList title="Borrower Pools">
          {!poolsAddresses.loaded && !backersData.loaded ? (
            <>
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
            </>
          ) : undefined}

          {poolsAddresses.loaded &&
            !backersData.loaded &&
            poolsAddresses.value.map((a) => <TranchedPoolCardSkeleton key={a} />)}

          {backersData.loaded &&
            backersData.value.map((p) => (
              <TranchedPoolCard key={`${p.tranchedPool.address}`} poolBacker={p} disabled={!loaded} />
            ))}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
