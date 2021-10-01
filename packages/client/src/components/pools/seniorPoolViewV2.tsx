import {useState, useEffect, useContext} from "react"
import EarnActionsContainer from "../earnActionsContainerV2"
import PoolStatus from "../poolStatusV2"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {assertNonNullable, displayDollars} from "../../utils"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {useStaleWhileRevalidating} from "../../hooks/useAsync"
import {eligibleForSeniorPool, useKYC} from "../../hooks/useKYC"
import {useApolloClient} from "@apollo/client"
import {getSeniorPoolByID, getUserByID} from "../../graphql/queries"
import {User, SeniorPool, Query} from "../../graphql/types"
import BigNumber from "bignumber.js"

function SeniorPoolViewV2(): JSX.Element {
  const {pool, user, goldfinchConfig} = useContext(AppContext)
  const [capitalProvider, setCapitalProvider] = useState<User>()
  const [poolData, setPoolData] = useState<SeniorPool>()
  const client = useApolloClient()

  const kycResult = useKYC()
  const kyc = useStaleWhileRevalidating(kycResult)

  useEffect(() => {
    async function refreshAllData() {
      const capitalProviderAddress = user.loaded && user.address
      assertNonNullable(pool)

      refreshPoolData(pool.address)
      refreshCapitalProviderData(capitalProviderAddress)
    }

    if (pool) {
      refreshAllData()
    }
  }, [pool, user])

  async function actionComplete() {
    assertNonNullable(pool)

    await refreshPoolData(pool.address)
    return refreshCapitalProviderData(capitalProvider!.id)
  }

  async function refreshCapitalProviderData(address: string | boolean) {
    if (address) {
      const {data} = await client.query<User>({query: getUserByID, variables: {id: address.toLowerCase()}})
      console.log(data)
      setCapitalProvider(data)
    }
  }

  function remainingCapacity(this: any, maxPoolCapacity: BigNumber): BigNumber {
    let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
    return new BigNumber(maxPoolCapacity).minus(cappedBalance)
  }

  async function refreshPoolData(address: string) {
    const {
      data: {seniorPool},
    } = await client.query<Query>({query: getSeniorPoolByID, variables: {id: address.toLowerCase()}})

    const seniorPoolData = {
      ...seniorPool,
      lastestPoolStatus: {
        ...seniorPool?.lastestPoolStatus,
        balance: new BigNumber(seniorPool?.lastestPoolStatus?.balance),
        compoundBalance: new BigNumber(seniorPool?.lastestPoolStatus?.compoundBalance),
        cumulativeDrawdowns: new BigNumber(seniorPool?.lastestPoolStatus?.cumulativeDrawdowns),
        cumulativeWritedowns: new BigNumber(seniorPool?.lastestPoolStatus?.cumulativeWritedowns),
        defaultRate: new BigNumber(seniorPool?.lastestPoolStatus?.defaultRate),
        estimatedApy: new BigNumber(seniorPool?.lastestPoolStatus?.estimatedApy),
        estimatedTotalInterest: new BigNumber(seniorPool?.lastestPoolStatus?.estimatedTotalInterest),
        id: new BigNumber(seniorPool!.lastestPoolStatus.id),
        rawBalance: new BigNumber(seniorPool?.lastestPoolStatus?.rawBalance),
        totalLoansOutstanding: new BigNumber(seniorPool?.lastestPoolStatus?.totalLoansOutstanding),
        totalPoolAssets: new BigNumber(seniorPool?.lastestPoolStatus?.totalPoolAssets),
        totalShares: new BigNumber(seniorPool?.lastestPoolStatus?.totalShares),
        remainingCapacity: remainingCapacity,
      },
    }

    setPoolData(seniorPoolData)
  }

  let earnMessage = "Loading..."
  if (capitalProvider || user.noWeb3) {
    earnMessage = "Pools / Senior Pool"
  }

  let maxCapacityNotice = <></>
  let maxCapacity = goldfinchConfig.totalFundsLimit
  if (poolData && goldfinchConfig && poolData.lastestPoolStatus?.remainingCapacity(maxCapacity).isEqualTo("0")) {
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
      <ConnectionNotice requireSignIn={true} requireKYC={{kyc: kycResult, condition: eligibleForSeniorPool}} />
      {maxCapacityNotice}
      <InvestorNotice />
      <EarnActionsContainer
        poolData={poolData}
        capitalProvider={capitalProvider!}
        actionComplete={actionComplete}
        kyc={kyc}
      />
      <PoolStatus poolData={poolData} />
    </div>
  )
}

export default SeniorPoolViewV2
