import {useState, useEffect, useContext} from "react"
import EarnActionsContainer from "../earnActionsContainer"
import PoolStatus from "../poolStatus"
import ConnectionNotice from "../connectionNotice"
import {CapitalProvider, fetchCapitalProviderData, PoolData, SeniorPool} from "../../ethereum/pool"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {assertNonNullable, displayDollars} from "../../utils"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {useLazyQuery} from "@apollo/client"
import BigNumber from "bignumber.js"
import {GET_SENIOR_POOL_AND_PROVIDER_DATA} from "../../graphql/queries"
import {getSeniorPoolAndProviders, getSeniorPoolAndProvidersVariables} from "../../graphql/types"
import {GraphSeniorPoolData, GraphUserData, isGraphSeniorPoolData, isGraphUserData} from "../../graphql/utils"
import {parseSeniorPool, parseUser} from "../../graphql/parsers"

function SeniorPoolView(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider | GraphUserData>()
  const [poolData, setPoolData] = useState<PoolData | GraphSeniorPoolData>()
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)
  const [fetchSeniorPoolAndProviderData, {data, refetch}] = useLazyQuery<
    getSeniorPoolAndProviders,
    getSeniorPoolAndProvidersVariables
  >(GET_SENIOR_POOL_AND_PROVIDER_DATA)

  const enableSeniorPoolV2 = process.env.REACT_APP_TOGGLE_THE_GRAPH === "true"

  const loadedCapitalProvider = isGraphUserData(capitalProvider) || capitalProvider?.loaded
  const loadedPoolData = isGraphSeniorPoolData(poolData) || poolData?.loaded

  useEffect(() => {
    if (enableSeniorPoolV2) {
      fetchSeniorPoolAndProviderData({
        variables: {userID: ""},
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const capitalProviderAddress = user.loaded && "0x001be549fa377710b9e59d57bbdf593ce1e379ca"
    if (pool) {
      fetchData(capitalProviderAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, user])

  useEffect(() => {
    async function setGraphData() {
      assertNonNullable(data)

      const {seniorPools, user} = data
      let seniorPool = seniorPools[0]!
      setPoolData(await parseSeniorPool(seniorPool, pool))
      setCapitalProvider(await parseUser(user, seniorPool, pool?.fidu))
    }
    if (data) {
      setGraphData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function refreshAllData(capitalProviderAddress) {
    assertNonNullable(pool)

    refreshPoolData(pool)
    refreshCapitalProviderData(pool, capitalProviderAddress)
  }

  async function fetchData(capitalProviderAddress) {
    if (enableSeniorPoolV2) {
      fetchSeniorPoolAndProviderData({
        variables: {userID: capitalProviderAddress ? capitalProviderAddress.toLowerCase() : ""},
      })
    } else {
      refreshAllData(capitalProviderAddress)
    }
  }

  async function actionComplete() {
    if (refetch) {
      refetch({userID: capitalProvider!.address.toLowerCase()})
    } else {
      refreshAllData(capitalProvider!.address)
    }
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
  if (loadedCapitalProvider || user.noWeb3) {
    earnMessage = "Pools / Senior Pool"
  }

  let maxCapacityNotice = <></>
  let maxCapacity = goldfinchConfig.totalFundsLimit
  let remainingCapacity = poolData?.remainingCapacity(maxCapacity) || new BigNumber("0")
  if (loadedPoolData && goldfinchConfig && remainingCapacity.isZero()) {
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
      <ConnectionNotice requireKYC={{kyc: kycResult, condition: (kyc) => eligibleForSeniorPool(kyc, user)}} />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer
        poolData={poolData}
        capitalProvider={capitalProvider}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolView
