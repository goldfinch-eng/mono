import {ApolloError, DocumentNode, useQuery} from "@apollo/client"
import {assertNonNullable} from "@goldfinch-eng/utils/src/type"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {getSeniorPool, getTranchedPoolsData} from "../graphql/types"
import {AppRoute} from "../types/routes"

export type UseGraphQuerierConfig = {
  // The route on which this invocation of the `useGraphQuerier` hook is used.
  route: AppRoute
  // Whether, upon a successful query, the current-block that triggered the query
  // should be set as the current-block-triggering-last-successful-graph-refresh for
  // the `route`. This corresponds to whether this usage of the `useGraphQuerier` hook is
  // located at the leaf of the component tree for `route`.
  setAsLeaf: boolean
}

type GraphData = getTranchedPoolsData | getSeniorPool

interface UseGraphQuerierReturnValue<T extends GraphData> {
  loading: boolean
  error?: ApolloError
  data?: T
}

export function useGraphQuerier<T extends GraphData>(
  config: UseGraphQuerierConfig,
  query: DocumentNode,
  skip: boolean
): UseGraphQuerierReturnValue<T> {
  const {
    currentBlock,
    setHasGraphError,
    leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh,
    setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh,
  } = useContext(AppContext)
  const [graphBlockNumber, setGraphBlockNumber] = useState<number>()
  const [hasBlockError, setHasBlockError] = useState<boolean>(false)
  const [hasQueryError, setHasQueryError] = useState<boolean>(false)

  const {loading, error, data, refetch} = useQuery(query, {skip, notifyOnNetworkStatusChange: true})

  useEffect(() => {
    if (data && currentBlock) {
      const {_meta} = data
      assertNonNullable(_meta)
      assertNonNullable(_meta.block)
      if (!graphBlockNumber) {
        // For the initial fetch, set `graphBlockNumber` state, and if this hook is configured such that
        // its querying is done at the leaf of the component tree (as far as queries to The Graph are
        // concerned; not talking about web3 here) set current-block-triggering-last-successful-graph-refresh
        // for the leaf.
        setGraphBlockNumber(_meta.block.number)

        if (config.setAsLeaf) {
          assertNonNullable(setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh)
          setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh(config.route, currentBlock)
        }
      } else if (graphBlockNumber < _meta.block.number) {
        // For all refetches, update `graphBlockNumber` state.
        setGraphBlockNumber(_meta.block.number)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentBlock])

  useEffect(() => {
    if (currentBlock) {
      assertNonNullable(leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh)
      assertNonNullable(setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh)

      // If current-block-triggering-last-successful-graph-refresh is now outdated for the
      // route on which this invocation of the hook is used, refetch. This is appropriate even
      // if `!config.setAsLeaf`.
      const leafCurrentBlockTriggeringLastSuccessfulGraphRefresh =
        leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh[config.route]
      if (
        leafCurrentBlockTriggeringLastSuccessfulGraphRefresh &&
        currentBlock.number > leafCurrentBlockTriggeringLastSuccessfulGraphRefresh.number
      ) {
        const newLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh = currentBlock

        refetch()
          .then((): void => {
            // If this hook is configured such that its querying is done at the leaf of the component
            // tree (as far as queries to The Graph are concerned; not talking about web3 here), set
            // current-block-triggering-last-successful-graph-refresh for the leaf, upon the success
            // of the refresh.
            if (config.setAsLeaf) {
              setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh(
                config.route,
                newLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh
              )
            }
          })
          .catch((err: unknown) => {
            console.error("Refetch failed", err)
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock])

  useEffect(() => {
    if (hasBlockError) {
      setHasGraphError?.(true)
    } else {
      setHasGraphError?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBlockError, hasQueryError])

  useEffect(() => {
    if (hasBlockError) setHasBlockError(false)
    if (hasQueryError) setHasQueryError(false)

    if (currentBlock?.number && graphBlockNumber && graphBlockNumber + 10 < currentBlock.number) {
      console.error(`
        [The Graph] Block ingestor lagging behind: Block number is out of date.
        The latest block is ${currentBlock.number},
        but The Graph API returned ${graphBlockNumber}.`)
      setHasBlockError(true)
    }

    if (error) {
      const {graphQLErrors, networkError} = error
      if (graphQLErrors) {
        graphQLErrors.forEach(({message, locations}) =>
          console.error(`[The Graph] GraphQL error: Message: ${message}, Location: ${locations}`)
        )
      }
      if (networkError) {
        console.error(`[The Graph] Network error: ${networkError}`)
      }
      setHasQueryError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphBlockNumber, error])

  return {loading, error, data}
}

export default useGraphQuerier
