import {ApolloError} from "@apollo/client"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {SeniorPoolStatus} from "../components/Earn/types"
import {usdcToAtomic} from "../ethereum/erc20"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {CapitalProvider} from "../ethereum/pool"
import {PoolState, TranchedPool, TranchedPoolBacker} from "../ethereum/tranchedPool"
import {UserLoaded} from "../ethereum/user"
import {parseBackers} from "../graphql/parsers"
import {GET_TRANCHED_POOLS_DATA} from "../graphql/queries"
import {getTranchedPoolsData, getTranchedPoolsData_tranchedPools} from "../graphql/types"
import {POOL_CREATED_EVENT} from "../types/events"
import {Loadable} from "../types/loadable"
import {BlockInfo} from "../utils"
import useGraphQuerier, {UseGraphQuerierConfig} from "./useGraphQuerier"

// Filter out 0 limit (inactive) and test pools
export const MIN_POOL_LIMIT = usdcToAtomic(process.env.REACT_APP_POOL_FILTER_LIMIT || "200")

function sortPoolBackers(poolBackers: TranchedPoolBacker[]): TranchedPoolBacker[] {
  return poolBackers.sort((a, b) =>
    // Primary sort: by pool status. Open pools are sorted in reverse-chronological order
    // of fundable-at time.
    a.tranchedPool.poolState === PoolState.Open && b.tranchedPool.poolState === PoolState.Open
      ? b.tranchedPool.fundableAt.toNumber() - a.tranchedPool.fundableAt.toNumber()
      : a.tranchedPool.poolState - b.tranchedPool.poolState ||
        // Secondary sort: descending by user's balance
        b.balanceInDollars.comparedTo(a.balanceInDollars) ||
        // Tertiary sort: reverse-chronological by launch time.
        (a.tranchedPool.metadata?.launchTime && b.tranchedPool.metadata?.launchTime
          ? b.tranchedPool.metadata.launchTime - a.tranchedPool.metadata.launchTime
          : // Quaternary sort: alphabetical by display name.
            a.tranchedPool.displayName.localeCompare(b.tranchedPool.displayName))
  )
}

export type TranchedPoolSubgraphData = {
  backers: Loadable<TranchedPoolBacker[]>
  loading: boolean
  error: ApolloError | undefined
}

export function useTranchedPoolSubgraphData(
  graphQuerierConfig: UseGraphQuerierConfig,
  skip = false
): TranchedPoolSubgraphData {
  const {goldfinchProtocol, currentBlock, user, userWalletWeb3Status} = useContext(AppContext)
  const [backers, setBackers] = useState<Loadable<TranchedPoolBacker[]>>({
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
      goldfinchProtocol: GoldfinchProtocol,
      currentBlock: BlockInfo,
      userAddress?: string
    ) {
      const backers = await parseBackers(tranchedPools, goldfinchProtocol, currentBlock, userAddress)
      const activePoolBackers = backers.filter(
        (p) =>
          p.tranchedPool.metadata &&
          p.tranchedPool.creditLine.limit &&
          p.tranchedPool.creditLine.limit.gte(MIN_POOL_LIMIT)
      )
      setBackers({
        loaded: true,
        value: sortPoolBackers(activePoolBackers),
      })
    }

    if (data?.tranchedPools && goldfinchProtocol && currentBlock) {
      parseData(data.tranchedPools, goldfinchProtocol, currentBlock, user?.address)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, data, user?.address, currentBlock, userWalletWeb3Status])

  return {loading, error, backers}
}

export type PoolBackersWeb3Data = {
  backers: Loadable<TranchedPoolBacker[]>
  poolsAddresses: Loadable<string[]>
}

export function usePoolBackersWeb3(skip = false): PoolBackersWeb3Data {
  const {user, goldfinchProtocol, currentBlock} = useContext(AppContext)
  let [backers, setBackers] = useState<Loadable<TranchedPoolBacker[]>>({
    loaded: false,
    value: undefined,
  })
  const [poolsAddresses, setPoolsAddresses] = useState<Loadable<string[]>>({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    async function loadTranchedPools(
      goldfinchProtocol: GoldfinchProtocol,
      user: UserLoaded | undefined,
      currentBlock: BlockInfo
    ) {
      let poolEvents = await goldfinchProtocol.queryEvents(
        "GoldfinchFactory",
        [POOL_CREATED_EVENT],
        undefined,
        currentBlock.number
      )
      let poolAddresses = poolEvents.map((e) => e.returnValues.pool)

      setPoolsAddresses({
        loaded: true,
        value: poolAddresses,
      })
      let tranchedPools = poolAddresses.map((a) => new TranchedPool(a, goldfinchProtocol))
      await Promise.all(tranchedPools.map((p) => p.initialize(currentBlock)))
      tranchedPools = tranchedPools.filter((p) => p.metadata)
      const activePoolBackers = tranchedPools
        .filter((p) => p.creditLine.limit.gte(MIN_POOL_LIMIT))
        .map((p) => new TranchedPoolBacker(user?.address, p, goldfinchProtocol))
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

export type SeniorPoolStatusWeb3Data = {seniorPoolStatus: Loadable<SeniorPoolStatus>}

export function useSeniorPoolStatusWeb3(
  capitalProvider: Loadable<CapitalProvider>,
  skip = false
): SeniorPoolStatusWeb3Data {
  const {pool, goldfinchConfig} = useContext(AppContext)
  const [seniorPoolStatus, setSeniorPoolStatus] = useState<Loadable<SeniorPoolStatus>>({
    loaded: false,
    value: undefined,
  })

  useEffect(() => {
    if (pool && goldfinchConfig && !skip) {
      setSeniorPoolStatus({
        loaded: true,
        value: {
          totalPoolAssets: pool.info.value.poolData.totalPoolAssets,
          availableToWithdrawInDollars: capitalProvider.value?.availableToWithdrawInDollars,
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
