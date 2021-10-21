/* eslint-disable @typescript-eslint/no-unused-vars */
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
import {useQuery} from "@apollo/client"
import {GET_SENIOR_POOL_AND_PROVIDER_DATA} from "../../graphql/queries"
import {isPoolData, parseSeniorPool, parseUser, SeniorPoolData, UserData} from "../../graphql/helpers"
import {getSeniorPoolAndProviders} from "../../graphql/types"
import {PoolData} from "../../ethereum/pool"
import BigNumber from "bignumber.js"

function SeniorPoolViewV2(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [poolData, setPoolData] = useState<SeniorPoolData | PoolData>()
  const [capitalProvider, setCapitalProvider] = useState<UserData>()
  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)
  const {data, refetch} = useQuery<getSeniorPoolAndProviders>(GET_SENIOR_POOL_AND_PROVIDER_DATA, {
    variables: {
      userID: user.loaded ? user.address : "",
    },
  })

  let remainingCapacity
  remainingCapacity = poolData?.remainingCapacity(goldfinchConfig.totalFundsLimit)

  useEffect(() => {
    async function setData() {
      const {seniorPools, user} = data!
      let seniorPool = seniorPools[0]!
      setPoolData(parseSeniorPool(seniorPool))
      setCapitalProvider(await parseUser(user, seniorPool.lastestPoolStatus.sharePrice, pool!))
    }

    if (data && pool) {
      setData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data])

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
      <div className="page-header">{poolData || user.noWeb3 ? "Pools / Senior Pool" : "Loading..."}</div>
      <ConnectionNotice requireKYC={{kyc: kycResult, condition: (kyc) => eligibleForSeniorPool(kyc, user)}} />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer poolData={poolData} capitalProvider={capitalProvider} actionComplete={refetch} kyc={kyc} />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolViewV2
