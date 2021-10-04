import {useState, useEffect, useContext} from "react"
import EarnActionsContainer from "../earnActionsContainer"
import PoolStatus from "../poolStatus"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {displayDollars} from "../../utils"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {ApolloQueryResult, useApolloClient} from "@apollo/client"
import {GET_SENIOR_POOL_AND_PROVIDER_DATA} from "../../graphql/queries"
import {parseSeniorPool, parseUser} from "../../helpers"
import {Query} from "../../graphql/types"
import {CapitalProvider, emptyCapitalProvider, PoolData} from "../../ethereum/pool"

function SeniorPoolViewV2(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<CapitalProvider>(emptyCapitalProvider())
  const [poolData, setPoolData] = useState<PoolData>()
  const client = useApolloClient()

  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)

  useEffect(() => {
    const capitalProviderAddress = user.loaded && user.address
    refreshData(capitalProviderAddress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function actionComplete() {
    return await refreshData(capitalProvider.address)
  }

  async function refreshData(capitalProviderAddress: string | false) {
    const {
      data: {seniorPools, user: capitalProvider},
    }: ApolloQueryResult<Query> = await client.query({
      query: GET_SENIOR_POOL_AND_PROVIDER_DATA,
      variables: {
        userID: capitalProviderAddress ? capitalProviderAddress.toLowerCase() : "",
      },
    })

    const seniorPool = seniorPools![0]!

    setCapitalProvider(parseUser(capitalProvider))
    setPoolData(parseSeniorPool(seniorPool, pool!))
  }

  let maxCapacityNotice = <></>
  let maxCapacity = goldfinchConfig.totalFundsLimit
  if (poolData && goldfinchConfig && poolData.remainingCapacity(maxCapacity).isEqualTo("0")) {
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
      <div className="page-header">{capitalProvider.loaded || user.noWeb3 ? "Pools / Senior Pool" : "Loading..."}</div>
      <ConnectionNotice requireSignIn={true} requireKYC={{kyc: kycResult, condition: eligibleForSeniorPool}} />
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

export default SeniorPoolViewV2
