import {useContext, useEffect, useState} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {
  CapitalProvider,
  emptyCapitalProvider,
  fetchCapitalProviderData,
  PoolData,
  SeniorPool,
} from "../../ethereum/pool"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {assertNonNullable, displayDollars} from "../../utils"
import ConnectionNotice from "../connectionNotice"
import EarnActionsContainer from "../earnActionsContainer"
import InvestorNotice from "../investorNotice"
import PoolStatus from "../poolStatus"
import StakeFiduBanner from "../stakeFiduBanner"

function SeniorPoolView(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>(emptyCapitalProvider())
  const [poolData, setPoolData] = useState<PoolData>()
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress = user.loaded && user.address
      assertNonNullable(pool)

      refreshPoolData(pool)
      refreshCapitalProviderData(pool, capitalProviderAddress)
    }

    if (pool) {
      refreshAllData()
    }
  }, [pool, user])

  async function actionComplete() {
    assertNonNullable(pool)

    await refreshPoolData(pool)
    return refreshCapitalProviderData(pool, capitalProvider!.address)
  }

  async function refreshCapitalProviderData(pool: SeniorPool, address: string | boolean) {
    const capitalProvider = await fetchCapitalProviderData(pool, address)
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
        requireSignIn={true}
        requireKYC={{kyc: kycResult, condition: eligibleForSeniorPool}}
        isPaused={!!poolData?.pool?.isPaused}
      />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer
        poolData={poolData}
        capitalProvider={capitalProvider}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <StakeFiduBanner poolData={poolData} capitalProvider={capitalProvider} />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolView
