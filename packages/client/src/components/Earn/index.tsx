import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {useEarn} from "../../contexts/EarnContext"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {CapitalProvider, fetchCapitalProviderData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {Loadable} from "../../types/loadable"
import {assertNonNullable, displayDollars, displayPercent} from "../../utils"
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

export default function Earn() {
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

  console.log(pool?.info.value.poolData.estimatedApy, "estimatedApy")
  console.log(pool?.info.value.poolData.estimatedApyFromGfi, "estimatedApyFromGfi")

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
        <PoolList
          title="Senior Pool"
          subtitle="The simple, lower risk, lower return option. Capital is automatically diversified across Borrower pools, and protected by Backer capital."
        >
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
        <PoolList
          title="Borrower Pools"
          subtitle="The more active, higher risk, higher return option. Earn higher APYs by vetting borrowers and supplying first-loss capital directly to individual pools."
        >
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
