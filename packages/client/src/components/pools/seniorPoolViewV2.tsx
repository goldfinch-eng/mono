/* eslint-disable @typescript-eslint/no-unused-vars */
import {useState, useEffect, useContext} from "react"
import EarnActionsContainer from "../earnActionsContainerV2"
import PoolStatus from "../poolStatusV2"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {displayDollars} from "../../utils"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {useQuery} from "@apollo/client"
import {GET_SENIOR_POOL_AND_PROVIDER_DATA} from "../../graphql/queries"
import {parseSeniorPool, parseUser, SeniorPoolData, UserData} from "../../graphql/helpers"
import {Query} from "../../graphql/types"

function SeniorPoolViewV2(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [poolData, setPoolData] = useState<SeniorPoolData>()
  const [capitalProvider, setCapitalProvider] = useState<UserData>()
  const {data, refetch} = useQuery<Query>(GET_SENIOR_POOL_AND_PROVIDER_DATA, {
    variables: {
      userID: user.loaded ? "0x0000000506063a51c6ce59906d8c40f7d7fe92a7" : "",
    },
  })

  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)

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
  }, [user, data, pool])

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
