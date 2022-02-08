import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {useEarn} from "../../contexts/EarnContext"
import {BackerRewardsLoaded} from "../../ethereum/backerRewards"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {CapitalProvider, fetchCapitalProviderData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {UserLoaded} from "../../ethereum/user"
import {ONE_QUADRILLION_USDC} from "../../ethereum/utils"
import {useCurrentRoute} from "../../hooks/useCurrentRoute"
import {Loadable, Loaded} from "../../types/loadable"
import {assertNonNullable, displayDollars, sameBlock} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import PoolList from "./PoolList"
import PortfolioOverview from "./PortfolioOverview"
import PortfolioOverviewSkeleton from "./PortfolioOverviewSkeleton"
import SeniorPoolCard from "./SeniorPoolCard"
import SeniorPoolCardSkeleton from "./SeniorPoolCardSkeleton"
import TranchedPoolCard from "./TranchedPoolCard"
import TranchedPoolCardSkeleton from "./TranchedPoolCardSkeleton"
import {TranchedPoolsEstimatedApyFromGfi} from "./types"

export default function Earn() {
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
    if (backers.loaded && pool && gfi && backerRewards) {
      refreshTranchedPoolsEstimatedApyFromGfi(backers, pool, gfi, backerRewards)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backers, pool, gfi, backerRewards])

  async function refreshTranchedPoolsEstimatedApyFromGfi(
    backers: Loaded<TranchedPoolBacker[]>,
    pool: SeniorPoolLoaded,
    gfi: GFILoaded,
    backerRewards: BackerRewardsLoaded
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    if (
      sameBlock(pool.info.value.currentBlock, gfi.info.value.currentBlock) &&
      sameBlock(gfi.info.value.currentBlock, backerRewards.info.value.currentBlock)
    ) {
      const estimatedApyFromGfi = await backerRewards.estimateApyFromGfiByTranchedPool(
        backers.value.map((backer) => backer.tranchedPool),
        pool,
        gfi
      )
      setTranchedPoolsEstimatedApyFromGfi({
        loaded: true,
        value: {
          currentBlock: gfi.info.value.currentBlock,
          estimatedApyFromGfi,
        },
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
        <PoolList
          title="Senior Pool"
          subtitle="The simple, lower risk, lower return option. Capital is automatically diversified across Borrower pools, and protected by Backer capital."
        >
          {seniorPoolStatus.loaded ? (
            <SeniorPoolCard
              balance={displayDollars(usdcFromAtomic(seniorPoolStatus.value.totalPoolAssets))}
              userBalance={displayDollars(seniorPoolStatus.value.availableToWithdrawInDollars)}
              estimatedApyFromSupplying={seniorPoolStatus.value.estimatedApy}
              estimatedApyFromGfi={pool?.info.value.poolData.estimatedApyFromGfi}
              estimatedApy={
                seniorPoolStatus.value.estimatedApy || pool?.info.value.poolData.estimatedApyFromGfi
                  ? (seniorPoolStatus.value.estimatedApy || new BigNumber(0)).plus(
                      pool?.info.value.poolData.estimatedApyFromGfi || new BigNumber(0)
                    )
                  : undefined
              }
              limit={limitToDisplay}
              remainingCapacity={seniorPoolStatus.value.remainingCapacity}
              disabled={!loaded}
              userBalanceDisabled={!seniorPoolStatus.value.availableToWithdrawInDollars}
            />
          ) : (
            <SeniorPoolCardSkeleton />
          )}
        </PoolList>
        <PoolList
          title="Borrower Pools"
          subtitle="The more active, higher risk, higher return option. Earn higher APYs by vetting borrowers and supplying first-loss capital directly to individual pools."
        >
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
                poolEstimatedBackersOnlyApyFromGfi={
                  tranchedPoolsEstimatedApyFromGfi.value?.estimatedApyFromGfi?.[p.tranchedPool.address]?.backersOnly
                }
                poolEstimatedSeniorPoolMatchingApyFromGfi={
                  tranchedPoolsEstimatedApyFromGfi.value?.estimatedApyFromGfi?.[p.tranchedPool.address]
                    ?.seniorPoolMatching
                }
                disabled={!loaded}
              />
            ))}
        </PoolList>
      </div>
    </div>
  )
}
