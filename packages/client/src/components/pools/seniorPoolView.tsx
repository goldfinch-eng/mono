import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {CapitalProvider, fetchCapitalProviderData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {useCurrentRoute} from "../../hooks/useCurrentRoute"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {useSession} from "../../hooks/useSignIn"
import {Loadable} from "../../types/loadable"
import {assertNonNullable, displayDollars} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import EarnActionsContainer from "../earnActionsContainer"
import InvestorNotice from "../investorNotice"
import PoolStatus from "../poolStatus"
import StakeFiduBanner from "../stakeFiduBanner"

function SeniorPoolView(): JSX.Element {
  const {web3Status, pool, user, goldfinchConfig, stakingRewards, gfi, refreshCurrentBlock, setLeafCurrentBlock} =
    useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)
  const session = useSession()
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

    // TODO Would be ideal to refactor this component so that the child components it renders all
    // receive state that is consistent, i.e. using `pool.poolData`, `capitalProvider` state,
    // `stakingRewards`, `gfi`, and `user` that are guaranteed to be based on the same block number. For now,
    // here we ensure that the derivation of `capitalProvider` state is done using `pool.poolData`,
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
      setLeafCurrentBlock(currentRoute, pool.info.value.currentBlock)
    }
  }

  async function actionComplete() {
    assertNonNullable(refreshCurrentBlock)
    refreshCurrentBlock()
  }

  const earnMessage = web3Status?.type === "no_web3" || capitalProvider.loaded ? "Pools / Senior Pool" : "Loading..."

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

  const disabled = session.status !== "authenticated"
  return (
    <div className="content-section">
      <div className="page-header"> {earnMessage}</div>
      <ConnectionNotice
        requireUnlock={false}
        requireGolist
        isPaused={pool?.info.loaded ? pool.info.value.isPaused : undefined}
      />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer
        disabled={disabled}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : undefined}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <StakeFiduBanner
        disabled={disabled}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : undefined}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <PoolStatus />
    </div>
  )
}

export default SeniorPoolView
