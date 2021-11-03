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
  const {pool, user, goldfinchConfig, networkMonitor} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider | GraphUserData>()
  const [poolData, setPoolData] = useState<PoolData | GraphSeniorPoolData>()
  const [graphBlockNumber, setGraphBlockNumber] = useState<number>()
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)
  const [fetchSeniorPoolAndProviderData, {data, error, refetch}] = useLazyQuery<
    getSeniorPoolAndProviders,
    getSeniorPoolAndProvidersVariables
  >(GET_SENIOR_POOL_AND_PROVIDER_DATA, {fetchPolicy: "no-cache"})

  const enableSeniorPoolV2 = process.env.REACT_APP_TOGGLE_THE_GRAPH === "true"

  const loadedCapitalProvider = isGraphUserData(capitalProvider) || capitalProvider?.loaded
  const loadedPoolData = isGraphSeniorPoolData(poolData) || poolData?.loaded
  const isPaused = isGraphSeniorPoolData(poolData) ? poolData.isPaused : !!poolData?.pool?.isPaused

  useEffect(() => {
    if (enableSeniorPoolV2) {
      fetchSeniorPoolAndProviderData({
        variables: {userID: ""},
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (
      networkMonitor?.currentBlockNumber &&
      graphBlockNumber &&
      graphBlockNumber + 5 < networkMonitor?.currentBlockNumber
    ) {
      console.error(`
        [The Graph] Block ingestor lagging behind: Block number is out of date.
        The latest block is ${networkMonitor?.currentBlockNumber}, 
        but The Graph API returned ${graphBlockNumber}.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphBlockNumber])

  useEffect(() => {
    const capitalProviderAddress = user.loaded && user.address
    if (pool) {
      fetchData(capitalProviderAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, user])

  useEffect(() => {
    async function setGraphData() {
      assertNonNullable(data)

      const {seniorPools, user, _meta} = data
      let seniorPool = seniorPools[0]!
      setPoolData(await parseSeniorPool(seniorPool, pool))
      setCapitalProvider(await parseUser(user, seniorPool, pool?.fidu))
      setGraphBlockNumber(_meta?.block.number)
    }
    if (data) {
      setGraphData()
    }

    if (error) {
      console.error(`[The Graph] Queries: failed request from the subgraph API: ${error.message}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error])

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
      <ConnectionNotice
        requireKYC={{kyc: kycResult, condition: (kyc) => eligibleForSeniorPool(kyc, user)}}
        isPaused={isPaused}
      />
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
