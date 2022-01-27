import BigNumber from "bignumber.js"
import React, {useContext, useEffect, useState} from "react"
import {useHistory} from "react-router-dom"
import {AppContext} from "../App"
import {useEarn} from "../contexts/EarnContext"
import {BackerRewardsLoaded} from "../ethereum/backerRewards"
import {usdcFromAtomic} from "../ethereum/erc20"
import {GFI, GFILoaded} from "../ethereum/gfi"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  SeniorPoolData,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../ethereum/pool"
import {PoolState, TranchedPoolBacker} from "../ethereum/tranchedPool"
import {UserLoaded} from "../ethereum/user"
import {ONE_QUADRILLION_USDC} from "../ethereum/utils"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {Loadable, Loaded} from "../types/loadable"
import {InfoIcon} from "../ui/icons"
import {assertNonNullable, BlockInfo, displayDollars, displayPercent, roundDownPenny, sameBlock} from "../utils"
import AnnualGrowthTooltipContent from "./AnnualGrowthTooltipContent"
import Badge from "./badge"
import ConnectionNotice from "./connectionNotice"

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
  seniorPoolData,
  capitalProvider,
  tranchedPoolBackers,
  tranchedPoolsEstimatedApyFromGfi,
}: {
  seniorPoolData: SeniorPoolData
  capitalProvider: Loaded<CapitalProvider>
  tranchedPoolBackers: Loaded<TranchedPoolBacker[]>
  tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi>
}) {
  const seniorPoolBalance = capitalProvider.value.totalSeniorPoolBalanceInDollars
  const estimatedAnnualGrowthFromSupplyingToSeniorPool = seniorPoolBalance.multipliedBy(seniorPoolData.estimatedApy)
  const seniorPoolUnrealizedGains = capitalProvider.value.unrealizedGainsInDollars

  let tranchedPoolsBalance = new BigNumber(0)
  let estimatedAnnualGrowthFromSupplyingToTranchedPools = new BigNumber(0)
  let tranchedPoolsUnrealizedGains = new BigNumber(0)
  let tranchedPoolsBalanceEarningGfi = new BigNumber(0)
  let tranchedPoolsGfi: Array<{
    address: string
    balanceEarningGfi: BigNumber
    estimatedApyFromGfi: BigNumber
  }> = []
  tranchedPoolBackers.value.forEach((p) => {
    tranchedPoolsBalance = tranchedPoolsBalance.plus(p.balanceInDollars)
    tranchedPoolsUnrealizedGains = tranchedPoolsUnrealizedGains.plus(p.unrealizedGainsInDollars)
    const estimatedJuniorApy = p.tranchedPool.estimateJuniorAPY(p.tranchedPool.estimatedLeverageRatio)
    estimatedAnnualGrowthFromSupplyingToTranchedPools = estimatedAnnualGrowthFromSupplyingToTranchedPools.plus(
      p.balanceInDollars.multipliedBy(estimatedJuniorApy)
    )

    const tranchedPoolEstimatedApyFromGfi =
      tranchedPoolsEstimatedApyFromGfi.value.estimatedApyFromGfi[p.tranchedPool.address]
    if (tranchedPoolEstimatedApyFromGfi) {
      // How much of the principal the user has supplied has earned / is earning GFI rewards at the
      // `tranchedPoolEstimatedApyFromGfi` rate? The definition of this principal amount needs to
      // correspond to / be consistent with how we defined the total amount of (junior) principal
      // dollars in the tranched pool that are earning GFI. The answer is: iterate over the
      // user's pool tokens for a tranched pool, summing (a) if the token corresponds to a closed slice,
      // the token's principal amount minus its redeemed amount minus its redeemable amount; or
      // (b) if the token corresponds to an open slice, the token's principal amount minus its
      // redeemed amount -- but not minus its redeemable amount, because we're assuming the user
      // won't withdraw that withdrawable amount, as that assumption corresponds to our assumption
      // that the pool as a whole fills up.
      // HACK: For now, because no tranched pools yet exist that have more than one slice, we
      // can get away with using (i.e. it remains correct to use) `p`'s sums across all pool tokens.
      // TODO: Once tranched pools exist having more than one slice, we MUST refactor this
      // to distinguish, when we sum, between pool tokens belonging to slices that are closed vs.
      // pool tokens belonging to slices that are open.

      const _balanceAtomicEarningGfi =
        p.tranchedPool.poolState < PoolState.SeniorLocked
          ? p.principalAmount.minus(p.principalRedeemed)
          : p.principalAtRisk
      const _balanceInDollarsEarningGfi = new BigNumber(usdcFromAtomic(_balanceAtomicEarningGfi))

      tranchedPoolsBalanceEarningGfi = tranchedPoolsBalanceEarningGfi.plus(_balanceInDollarsEarningGfi)
      tranchedPoolsGfi.push({
        address: p.tranchedPool.address,
        balanceEarningGfi: _balanceInDollarsEarningGfi,
        estimatedApyFromGfi: tranchedPoolEstimatedApyFromGfi,
      })
    }
  })

  const totalBalance = seniorPoolBalance.plus(tranchedPoolsBalance)
  const estimatedAnnualGrowthFromSupplying = estimatedAnnualGrowthFromSupplyingToSeniorPool.plus(
    estimatedAnnualGrowthFromSupplyingToTranchedPools
  )
  const totalUnrealizedGains = seniorPoolUnrealizedGains.plus(tranchedPoolsUnrealizedGains)

  const estimatedApyFromSupplying = totalBalance.gt(0)
    ? estimatedAnnualGrowthFromSupplying.dividedBy(totalBalance)
    : // TODO[PR] I think we shouldn't show the "global" apy from supplying here.
      // This was reported confusing in manual testing prior to the GFI launch. I also don't
      // think it makes sense to feature the senior pool APY, when there may be backer pools
      // with an APY superior to that. The senior pool APY and backer pool APYs can be seen
      // below on their respective cards.
      undefined

  const seniorPoolBalanceEarningGfi = capitalProvider.value.stakedSeniorPoolBalanceInDollars
  const estimatedApyFromGfiSeniorPool = GFI.estimateApyFromGfi(
    seniorPoolBalanceEarningGfi,
    seniorPoolBalance,
    seniorPoolData.estimatedApyFromGfi
  )

  // Tranched pools' APY-from-GFI is the average of the APY-from-GFI for each tranched pool,
  // weighted by how much the user has supplied (more precisely, how much they've supplied that
  // is earning GFI) to each pool.
  const estimatedApyFromGfiTranchedPools = tranchedPoolsBalanceEarningGfi.gt(0)
    ? tranchedPoolsGfi.reduce<BigNumber>(
        (acc, curr) =>
          acc.plus(
            curr.balanceEarningGfi.multipliedBy(curr.estimatedApyFromGfi).dividedBy(tranchedPoolsBalanceEarningGfi)
          ),
        new BigNumber(0)
      )
    : undefined

  const totalBalanceEarningGfi = seniorPoolBalanceEarningGfi.plus(tranchedPoolsBalanceEarningGfi)

  // Total APY-from-GFI is the average of the senior pool APY-from-GFI and
  // the tranched pools' APY-from-GFI, weighted by how much the user has supplied
  // to the senior pool vs. tranched pools.
  let estimatedApyFromGfi: BigNumber | undefined
  if ((estimatedApyFromGfiSeniorPool || estimatedApyFromGfiTranchedPools) && totalBalanceEarningGfi.gt(0)) {
    const seniorPoolPortion = (estimatedApyFromGfiSeniorPool || new BigNumber(0))
      .multipliedBy(seniorPoolBalanceEarningGfi)
      .dividedBy(totalBalanceEarningGfi)
    const tranchedPoolsPortion = (estimatedApyFromGfiTranchedPools || new BigNumber(0))
      .multipliedBy(tranchedPoolsBalanceEarningGfi)
      .dividedBy(totalBalanceEarningGfi)

    estimatedApyFromGfi = seniorPoolPortion.plus(tranchedPoolsPortion)
  }

  const estimatedAnnualGrowthFromGfi = estimatedApyFromGfi
    ? totalBalanceEarningGfi.multipliedBy(estimatedApyFromGfi)
    : new BigNumber(0)
  const estimatedAnnualGrowth = estimatedAnnualGrowthFromSupplying.plus(estimatedAnnualGrowthFromGfi)

  const estimatedApy =
    estimatedApyFromSupplying || estimatedApyFromGfi
      ? (estimatedApyFromSupplying || new BigNumber(0)).plus(estimatedApyFromGfi || new BigNumber(0))
      : undefined

  const unrealizedGainsPercent = totalUnrealizedGains.dividedBy(totalBalance)
  const displayUnrealizedGains = roundDownPenny(totalUnrealizedGains)

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
            <span data-tip="" data-for="annual-growth-tooltip" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
              <InfoIcon />
            </span>
          </div>
          <div className="value" data-testid="portfolio-est-growth">
            {displayDollars(roundDownPenny(estimatedAnnualGrowth))}
          </div>
          <div className="sub-value" data-testid="portfolio-est-growth-perc">{`${displayPercent(estimatedApy)} APY${
            estimatedApyFromGfi && estimatedApyFromGfi.gt(0) ? " (with GFI)" : ""
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

export function TranchedPoolCard({
  poolBacker,
  poolEstimatedApyFromGfi,
  disabled,
}: {
  poolBacker: TranchedPoolBacker
  poolEstimatedApyFromGfi: BigNumber | undefined
  disabled: boolean
}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  const estimatedApyFromSupplying = leverageRatio ? tranchedPool.estimateJuniorAPY(leverageRatio) : undefined
  const estimatedApy =
    estimatedApyFromSupplying || poolEstimatedApyFromGfi
      ? (estimatedApyFromSupplying || new BigNumber(0)).plus(poolEstimatedApyFromGfi || new BigNumber(0))
      : new BigNumber(NaN)

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

type TranchedPoolsEstimatedApyFromGfi = {
  currentBlock: BlockInfo
  estimatedApyFromGfi: {[tranchedPoolAddress: string]: BigNumber | undefined}
}

function Earn() {
  const {
    userWalletWeb3Status,
    pool,
    usdc,
    user,
    stakingRewards,
    backerRewards,
    gfi,
    currentBlock,
    setLeafCurrentBlock,
  } = useContext(AppContext)
  const {earnStore, setEarnStore} = useEarn()
  const [_capitalProvider, _setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const [tranchedPoolsEstimatedApyFromGfi, setTranchedPoolsEstimatedApyFromGfi] = useState<
    Loadable<TranchedPoolsEstimatedApyFromGfi>
  >({
    loaded: false,
    value: undefined,
  })
  const {backers, seniorPoolStatus, poolsAddresses, capitalProvider} = earnStore
  const currentRoute = useCurrentRoute()

  useEffect(() => {
    setEarnStore({
      ...earnStore,
      capitalProvider: _capitalProvider,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_capitalProvider])

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
      _setCapitalProvider(capitalProvider)
    }
  }

  useEffect(() => {
    if (backers.loaded && gfi && backerRewards) {
      refreshTranchedPoolsEstimatedApyFromGfi(backers, gfi, backerRewards)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backers, gfi, backerRewards])

  async function refreshTranchedPoolsEstimatedApyFromGfi(
    backers: Loaded<TranchedPoolBacker[]>,
    gfi: GFILoaded,
    backerRewards: BackerRewardsLoaded
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    if (gfi.info.value.currentBlock.number === backerRewards.info.value.currentBlock.number) {
      const estimatedApyFromGfi = await backerRewards.estimateApyFromGfiByTranchedPool(
        backers.value.map((backer) => backer.tranchedPool),
        gfi.info.value.supply,
        gfi.info.value.price,
        gfi.info.value.currentBlock
      )
      setTranchedPoolsEstimatedApyFromGfi({
        loaded: true,
        value: {currentBlock: gfi.info.value.currentBlock, estimatedApyFromGfi},
      })
    }
  }

  useEffect(() => {
    // Once capital provider data and tranched pools' estimated APY-from-GFI are finished refreshing,
    // call `setLeafCurrentBlock()`, as no more data remains to be refreshed.
    if (
      capitalProvider.loaded &&
      tranchedPoolsEstimatedApyFromGfi.loaded &&
      sameBlock(capitalProvider.value.currentBlock, tranchedPoolsEstimatedApyFromGfi.value.currentBlock) &&
      sameBlock(capitalProvider.value.currentBlock, currentBlock)
    ) {
      assertNonNullable(setLeafCurrentBlock)
      assertNonNullable(currentRoute)

      const leafCurrentBlock = capitalProvider.value.currentBlock

      setLeafCurrentBlock(currentRoute, leafCurrentBlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalProvider, tranchedPoolsEstimatedApyFromGfi, currentBlock])

  const loaded = pool && backers.loaded
  const earnMessage = userWalletWeb3Status?.type === "no_web3" || loaded ? "Pools" : "Loading..."
  let limitToDisplay: string
  if (seniorPoolStatus.value?.totalFundsLimit?.gte(ONE_QUADRILLION_USDC)) {
    limitToDisplay = "No Limit"
  } else if (seniorPoolStatus.value?.totalFundsLimit) {
    limitToDisplay = displayDollars(usdcFromAtomic(seniorPoolStatus.value.totalFundsLimit), 0)
  } else {
    limitToDisplay = displayDollars(undefined)
  }

  let seniorPoolDisplayApy: BigNumber | undefined
  if (pool?.info.value.poolData.estimatedApyFromGfi && seniorPoolStatus?.value?.estimatedApy) {
    seniorPoolDisplayApy = pool.info.value.poolData.estimatedApyFromGfi.plus(seniorPoolStatus.value.estimatedApy)
  } else {
    seniorPoolDisplayApy = seniorPoolStatus.value?.estimatedApy
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <div>{earnMessage}</div>
      </div>
      <ConnectionNotice requireUnlock={false} />
      {userWalletWeb3Status?.type === "no_web3" ||
      !pool ||
      !capitalProvider.loaded ||
      !backers.loaded ||
      !tranchedPoolsEstimatedApyFromGfi.loaded ? (
        <PortfolioOverviewSkeleton />
      ) : (
        <PortfolioOverview
          seniorPoolData={pool.info.value.poolData}
          capitalProvider={capitalProvider}
          tranchedPoolBackers={backers}
          tranchedPoolsEstimatedApyFromGfi={tranchedPoolsEstimatedApyFromGfi}
        />
      )}
      <div className="pools">
        <PoolList title="Senior Pool">
          {seniorPoolStatus.loaded ? (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(seniorPoolStatus.value.totalPoolAssets))}
              userBalance={displayDollars(seniorPoolStatus.value.availableToWithdrawInDollars)}
              apy={displayPercent(seniorPoolDisplayApy)}
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
          {!poolsAddresses.loaded && !backers.loaded ? (
            <>
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
              <TranchedPoolCardSkeleton />
            </>
          ) : undefined}

          {poolsAddresses.loaded &&
            !backers.loaded &&
            poolsAddresses.value.map((a) => <TranchedPoolCardSkeleton key={a} />)}

          {backers.loaded &&
            backers.value.map((p) => (
              <TranchedPoolCard
                key={`${p.tranchedPool.address}`}
                poolBacker={p}
                poolEstimatedApyFromGfi={
                  tranchedPoolsEstimatedApyFromGfi.value?.estimatedApyFromGfi?.[p.tranchedPool.address]
                }
                disabled={!loaded}
              />
            ))}
        </PoolList>
      </div>
    </div>
  )
}

export default Earn
