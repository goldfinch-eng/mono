import {useState, useEffect, useContext} from "react"
import EarnActionsContainer from "../earnActionsContainer"
import PoolStatus from "../poolStatus"
import ConnectionNotice from "../connectionNotice"
import {
  CapitalProvider,
  emptyCapitalProvider,
  fetchCapitalProviderData,
  Pool,
  PoolData,
  SeniorPool,
} from "../../ethereum/pool"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {assertNonNullable, displayDollars} from "../../utils"
import {usdcFromAtomic} from "../../ethereum/erc20"

function SeniorPoolView() {
  const {pool, v1Pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>(emptyCapitalProvider())
  const [poolData, setPoolData] = useState<PoolData>()

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress = user.loaded && user.address
      assertNonNullable(pool)
      assertNonNullable(v1Pool)

      refreshPoolData(pool)
      refreshCapitalProviderData(pool, v1Pool, capitalProviderAddress)
    }

    if (pool) {
      refreshAllData()
    }
  }, [pool, v1Pool, user])

  async function actionComplete() {
    assertNonNullable(pool)
    assertNonNullable(v1Pool)

    await refreshPoolData(pool)
    return refreshCapitalProviderData(pool, v1Pool, capitalProvider!.address)
  }

  async function refreshCapitalProviderData(pool: SeniorPool, v1Pool: Pool, address: string | boolean) {
    const capitalProvider = await fetchCapitalProviderData(pool, v1Pool, address)
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
      <ConnectionNotice requireVerify={true} />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={actionComplete} />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolView
