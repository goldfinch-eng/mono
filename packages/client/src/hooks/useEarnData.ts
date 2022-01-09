import {useContext, useEffect, useState} from "react"
import {ApolloError} from "@apollo/client"
import _ from "lodash"
import {AppContext} from "../App"
import {GET_TRANCHED_POOLS_DATA} from "../graphql/queries"
import {parseBackers} from "../graphql/parsers"
import {SeniorPoolStatus} from "../components/earn"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {BlockInfo} from "../utils"
import {Loadable} from "../types/loadable"
import {User} from "@sentry/browser"
import {POOL_CREATED_EVENT} from "../types/events"
import {CapitalProvider} from "../ethereum/pool"
import {RINKEBY} from "../ethereum/utils"
import useNonNullContext from "./useNonNullContext"
import {getTranchedPoolsData, getTranchedPoolsData_tranchedPools} from "../graphql/types"
import {usdcToAtomic} from "../ethereum/erc20"
import useGraphQuerier, {UseGraphQuerierConfig} from "./useGraphQuerier"

// Filter out 0 limit (inactive) and test pools
export const MIN_POOL_LIMIT = usdcToAtomic(process.env.REACT_APP_POOL_FILTER_LIMIT || "200")

function sortPoolBackers(poolBackers: PoolBacker[]): PoolBacker[] {
  return poolBackers.sort(
    (a, b) =>
      // Primary sort: ascending by tranched pool status (Open -> JuniorLocked -> ...)
      a.tranchedPool.poolState - b.tranchedPool.poolState ||
      // Secondary sort: descending by user's balance
      b.balanceInDollars.comparedTo(a.balanceInDollars) ||
      // Tertiary sort: alphabetical by display name, for the sake of stable ordering.
      a.tranchedPool.displayName.localeCompare(b.tranchedPool.displayName)
  )
}

export function useTranchedPoolSubgraphData(
  graphQuerierConfig: UseGraphQuerierConfig,
  skip = false
): {
  backers: Loadable<PoolBacker[]>
  loading: boolean
  error: ApolloError | undefined
} {
  const {goldfinchProtocol, currentBlock, user, userWalletWeb3Status} = useNonNullContext(AppContext)
  const [backers, setBackers] = useState<Loadable<PoolBacker[]>>({
    loaded: false,
    value: undefined,
  })

  const {loading, error, data} = useGraphQuerier<getTranchedPoolsData>(
    graphQuerierConfig,
    GET_TRANCHED_POOLS_DATA,
    skip
  )

  useEffect(() => {
    async function parseData(
      tranchedPools: getTranchedPoolsData_tranchedPools[],
      goldfinchProtocol?: GoldfinchProtocol,
      currentBlock?: BlockInfo,
      userAddress?: string
    ) {
      const backers = await parseBackers(tranchedPools, goldfinchProtocol, currentBlock, userAddress)
      const activePoolBackers = backers.filter(
        (p) => p.tranchedPool.creditLine.limit.gte(MIN_POOL_LIMIT) && p.tranchedPool.metadata
      )
      setBackers({
        loaded: true,
        value: sortPoolBackers(activePoolBackers),
      })
    }

    if (userWalletWeb3Status?.type === "no_web3" && data?.tranchedPools) {
      parseData(data.tranchedPools)
    }

    if (userWalletWeb3Status?.type !== "no_web3" && data?.tranchedPools && goldfinchProtocol && currentBlock) {
      parseData(data.tranchedPools, goldfinchProtocol, currentBlock, user?.address)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, data, user?.address, currentBlock, userWalletWeb3Status])

  return {loading, error, backers}
}

export function usePoolBackersWeb3(skip = false): {
  backers: Loadable<PoolBacker[]>
  poolsAddresses: Loadable<string[]>
} {
  const {user, goldfinchProtocol, currentBlock, network} = useNonNullContext(AppContext)
  let [backers, setBackers] = useState<Loadable<PoolBacker[]>>({
    loaded: false,
    value: undefined,
  })
  const [poolsAddresses, setPoolsAddresses] = useState<Loadable<string[]>>({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    async function loadTranchedPools(goldfinchProtocol: GoldfinchProtocol, user: User, currentBlock: BlockInfo) {
      let poolEvents = await goldfinchProtocol.queryEvents(
        "GoldfinchFactory",
        [POOL_CREATED_EVENT],
        undefined,
        currentBlock.number
      )
      let poolAddresses = poolEvents.map((e) => e.returnValues.pool)

      // Remove invalid pool on rinkeby that returns wrong number of values for getTranche
      if (network.name === RINKEBY) {
        poolAddresses = _.remove(poolAddresses, "0x3622Bf116643c5f2f1764924Ce6ce8814302BA76")
      }

      setPoolsAddresses({
        loaded: true,
        value: poolAddresses,
      })
      let tranchedPools = poolAddresses.map((a) => new TranchedPool(a, goldfinchProtocol))
      await Promise.all(tranchedPools.map((p) => p.initialize(currentBlock)))
      tranchedPools = tranchedPools.filter((p) => p.metadata)
      const activePoolBackers = tranchedPools
        .filter((p) => p.creditLine.limit.gte(MIN_POOL_LIMIT))
        .map((p) => new PoolBacker(user.address, p, goldfinchProtocol))
      await Promise.all(activePoolBackers.map((b) => b.initialize(currentBlock)))
      setBackers({
        loaded: true,
        value: sortPoolBackers(activePoolBackers),
      })
    }

    if (goldfinchProtocol && user && currentBlock && !skip) {
      loadTranchedPools(goldfinchProtocol, user, currentBlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, user, currentBlock, skip])

  return {backers, poolsAddresses}
}

export function useSeniorPoolStatusWeb3(
  capitalProvider: Loadable<CapitalProvider>,
  skip = false
): {seniorPoolStatus: Loadable<SeniorPoolStatus>} {
  const {pool, goldfinchConfig} = useContext(AppContext)
  const [seniorPoolStatus, setSeniorPoolStatus] = useState<Loadable<SeniorPoolStatus>>({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    if (pool && goldfinchConfig && capitalProvider.loaded && !skip) {
      setSeniorPoolStatus({
        loaded: true,
        value: {
          totalPoolAssets: pool.info.value.poolData.totalPoolAssets,
          availableToWithdrawInDollars: capitalProvider.value.availableToWithdrawInDollars,
          estimatedApy: pool.info.value.poolData.estimatedApy,
          totalFundsLimit: goldfinchConfig.totalFundsLimit,
          remainingCapacity: goldfinchConfig
            ? pool.info.value.poolData.remainingCapacity(goldfinchConfig.totalFundsLimit)
            : undefined,
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, goldfinchConfig, capitalProvider, skip])

  return {seniorPoolStatus}
}
