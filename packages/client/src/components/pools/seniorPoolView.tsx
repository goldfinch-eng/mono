import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {CapitalProvider, fetchCapitalProviderData, PoolData, SeniorPool, StakingRewards} from "../../ethereum/pool"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {useStakingRewards} from "../../hooks/useStakingRewards"
import {Loadable} from "../../types/loadable"
import {assertNonNullable, displayDollars} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import EarnActionsContainer from "../earnActionsContainer"
import InvestorNotice from "../investorNotice"
import PoolStatus from "../poolStatus"
import StakeFiduBanner from "../stakeFiduBanner"

const emptyCapitalProvider: CapitalProvider = {
  shares: {
    parts: {
      notStaked: new BigNumber(0),
      stakedNotLocked: new BigNumber(0),
      stakedLocked: new BigNumber(0),
    },
    aggregates: {
      staked: new BigNumber(0),
      withdrawable: new BigNumber(0),
      total: new BigNumber(0),
    },
  },
  stakedSeniorPoolBalanceInDollars: new BigNumber(0),
  totalSeniorPoolBalanceInDollars: new BigNumber(0),
  availableToStakeInDollars: new BigNumber(0),
  availableToWithdraw: new BigNumber(0),
  availableToWithdrawInDollars: new BigNumber(0),
  stakingRewards: {
    hasUnvested: false,
    unvested: null,
    unvestedInDollars: null,
    lastVestingEndTime: null,
  },
  address: "",
  allowance: new BigNumber(0),
  weightedAverageSharePrice: new BigNumber(0),
  unrealizedGains: new BigNumber(0),
  unrealizedGainsInDollars: new BigNumber(0),
  unrealizedGainsPercentage: new BigNumber(0),
}

function SeniorPoolView(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<Loadable<CapitalProvider>>({
    loaded: false,
    value: undefined,
  })
  const [poolData, setPoolData] = useState<PoolData>()
  const stakingRewards = useStakingRewards()
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress: string | undefined = user.loaded ? user.address : undefined
      assertNonNullable(pool)

      refreshPoolData(pool)
      refreshCapitalProviderData(pool, stakingRewards, capitalProviderAddress)
    }

    if (pool) {
      refreshAllData()
    }
  }, [pool, stakingRewards, user])

  async function actionComplete() {
    assertNonNullable(pool)

    await refreshPoolData(pool)
    return refreshCapitalProviderData(
      pool,
      stakingRewards,
      capitalProvider.loaded ? capitalProvider.value.address : undefined
    )
  }

  async function refreshCapitalProviderData(
    pool: SeniorPool,
    stakingRewards: StakingRewards | undefined,
    address: string | undefined
  ) {
    const capitalProvider = await fetchCapitalProviderData(pool, stakingRewards, address)
    setCapitalProvider(capitalProvider)
  }

  async function refreshPoolData(pool: SeniorPool) {
    await pool.initialize()
    setPoolData(pool.gf)
  }

  let earnMessage = "Loading..."
  if (capitalProvider.loaded || user.noWeb3) {
    earnMessage = "Pools / Senior Pool"
  }

  let maxCapacityNotice = <></>
  let maxCapacity = goldfinchConfig.totalFundsLimit
  if (poolData?.loaded && goldfinchConfig && poolData.remainingCapacity(maxCapacity).isEqualTo("0")) {
    maxCapacityNotice = (
      <div className="info-banner background-container">
        <div className="message">
          <span>
            The pool has reached its max capacity of {displayDollars(usdcFromAtomic(maxCapacity))}. Join our{" "}
            <a href="https://discord.gg/HVeaca3fN8">Discord</a> for updates on when the cap is raised.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="content-section">
      <div className="page-header"> {earnMessage}</div>
      <ConnectionNotice
        requireUnlock={false}
        requireKYC={{kyc: kycResult, condition: (kyc) => eligibleForSeniorPool(kyc, user)}}
        isPaused={!!poolData?.pool?.isPaused}
      />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer
        poolData={poolData}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : emptyCapitalProvider}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <StakeFiduBanner
        poolData={poolData}
        capitalProvider={capitalProvider.loaded ? capitalProvider.value : emptyCapitalProvider}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolView
