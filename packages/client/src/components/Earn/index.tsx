import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {useEarn} from "../../contexts/EarnContext"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {CapitalProvider, fetchCapitalProviderData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {Loadable, Loaded} from "../../types/loadable"
import {assertNonNullable, displayDollars, displayPercent, sameBlock} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import {useCurrentRoute} from "../../hooks/useCurrentRoute"
import {ONE_QUADRILLION_USDC} from "../../ethereum/utils"
import PortfolioOverviewSkeleton from "./PortfolioOverviewSkeleton"
import PoolList from "./PoolList"
import SeniorPoolCardSkeleton from "./SeniorPoolCardSkeleton"
import TranchedPoolCardSkeleton from "./TranchedPoolCardSkeleton"
import SeniorPoolCard from "./SeniorPoolCard"
import PortfolioOverview from "./PortfolioOverview"
import TranchedPoolCard from "./TranchedPoolCard"
import {TranchedPoolsEstimatedBackersOnlyApyFromGfi} from "./types"
import {TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {BackerRewardsLoaded} from "../../ethereum/backerRewards"
import BigNumber from "bignumber.js"

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
  const [tranchedPoolsEstimatedBackersOnlyApyFromGfi, setTranchedPoolsEstimatedBackersOnlyApyFromGfi] = useState<
    Loadable<TranchedPoolsEstimatedBackersOnlyApyFromGfi>
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
      refreshTranchedPoolsEstimatedBackersOnlyApyFromGfi(backers, gfi, backerRewards)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backers, gfi, backerRewards])

  async function refreshTranchedPoolsEstimatedBackersOnlyApyFromGfi(
    backers: Loaded<TranchedPoolBacker[]>,
    gfi: GFILoaded,
    backerRewards: BackerRewardsLoaded
  ) {
    assertNonNullable(setLeafCurrentBlock)
    assertNonNullable(currentRoute)

    if (gfi.info.value.currentBlock.number === backerRewards.info.value.currentBlock.number) {
      const estimatedBackersOnlyApyFromGfi = await backerRewards.estimateBackersOnlyApyFromGfiByTranchedPool(
        backers.value.map((backer) => backer.tranchedPool),
        gfi
      )
      setTranchedPoolsEstimatedBackersOnlyApyFromGfi({
        loaded: true,
        value: {
          currentBlock: gfi.info.value.currentBlock,
          estimatedBackersOnlyApyFromGfi,
        },
      })
    }
  }

  useEffect(() => {
    // Once capital provider data and tranched pools' estimated APY-from-GFI are finished refreshing,
    // call `setLeafCurrentBlock()`, as no more data remains to be refreshed.
    if (
      capitalProvider.loaded &&
      tranchedPoolsEstimatedBackersOnlyApyFromGfi.loaded &&
      sameBlock(capitalProvider.value.currentBlock, tranchedPoolsEstimatedBackersOnlyApyFromGfi.value.currentBlock) &&
      sameBlock(capitalProvider.value.currentBlock, currentBlock)
    ) {
      assertNonNullable(setLeafCurrentBlock)
      assertNonNullable(currentRoute)

      const leafCurrentBlock = capitalProvider.value.currentBlock

      setLeafCurrentBlock(currentRoute, leafCurrentBlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalProvider, tranchedPoolsEstimatedBackersOnlyApyFromGfi, currentBlock])

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
      !tranchedPoolsEstimatedBackersOnlyApyFromGfi.loaded ? (
        <PortfolioOverviewSkeleton />
      ) : (
        <PortfolioOverview
          seniorPoolData={pool.info.value.poolData}
          capitalProvider={capitalProvider}
          tranchedPoolBackers={backers}
          tranchedPoolsEstimatedBackersOnlyApyFromGfi={tranchedPoolsEstimatedBackersOnlyApyFromGfi}
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
                poolEstimatedBackersOnlyApyFromGfi={
                  tranchedPoolsEstimatedBackersOnlyApyFromGfi.value?.estimatedBackersOnlyApyFromGfi?.[
                    p.tranchedPool.address
                  ]
                }
                disabled={!loaded}
              />
            ))}
        </PoolList>
      </div>
    </div>
  )
}
