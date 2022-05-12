import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {CapitalProvider, fetchCapitalProviderData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {useCurrentRoute} from "../../hooks/useCurrentRoute"
import {Loadable} from "../../types/loadable"
import {assertNonNullable, displayDollars} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import EarnActionsContainer from "./EarnActionsContainer"
import InvestorNotice from "../KYCNotice/InvestorNotice"
import SeniorPoolStatus from "./SeniorPoolStatus"
import StakeFiduBanner from "../stakeFiduBanner"
import {Overview} from "./Overview"

function SeniorPoolView(): JSX.Element {
  const {
    userWalletWeb3Status,
    pool,
    user,
    goldfinchConfig,
    stakingRewards,
    gfi,
    refreshCurrentBlock,
    setLeafCurrentBlock,
  } = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const currentRoute = useCurrentRoute()

  useEffect(
    () => {
      if (pool && stakingRewards && gfi && user) {
        refreshCapitalProviderData(pool, stakingRewards, gfi, user)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, stakingRewards, gfi, user]
  )

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

  async function actionComplete() {
    assertNonNullable(refreshCurrentBlock)
    refreshCurrentBlock()
  }

  const earnMessage =
    userWalletWeb3Status?.type === "no_web3" || capitalProvider.loaded ? "Pools / Senior Pool" : "Loading..."

  let maxCapacityNotice = <></>
  if (
    pool &&
    goldfinchConfig &&
    pool.info.value.poolData.remainingCapacity(goldfinchConfig.totalFundsLimit).isEqualTo("0")
  ) {
    maxCapacityNotice = (
      <div className="info-banner background-container">
        <div className="message">
          <span>
            The pool has reached its max capacity of {displayDollars(usdcFromAtomic(goldfinchConfig.totalFundsLimit))}.
            Join our <a href="https://discord.gg/HVeaca3fN8">Discord</a> for updates on when the cap is raised.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="content-section">
      <div className="page-header"> {earnMessage}</div>
      <ConnectionNotice requireUnlock={false} requireGolist isPaused={pool ? pool.info.value.isPaused : undefined} />
      {maxCapacityNotice}
      <InvestorNotice user={user} allowedUIDTypes={pool?.info.value.poolData.allowedUIDTypes || []} />
      <EarnActionsContainer
        disabled={false}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : undefined}
        actionComplete={actionComplete}
      />
      <StakeFiduBanner
        disabled={false}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : undefined}
        actionComplete={actionComplete}
      />
      <SeniorPoolStatus pool={pool} />
      <Overview pool={pool} />
    </div>
  )
}

export default SeniorPoolView
