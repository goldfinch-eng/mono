import {useState, useEffect, useContext} from "react"
import {AppContext} from "../App"
import {useQuery, ApolloError, DocumentNode} from "@apollo/client"
import {getTranchedPoolsData} from "../graphql/types"
import {BlockInfo} from "../utils"
import {useCurrentRoute} from "./useCurrentRoute"
import {assertNonNullable} from "@goldfinch-eng/utils/src/type"
import {EARN_ROUTE} from "../types/routes"

interface UseGraphQuerierReturnValue {
  loading: boolean
  error?: ApolloError
  data?: getTranchedPoolsData
}

export function useGraphQuerier(QUERY: DocumentNode, skip: boolean): UseGraphQuerierReturnValue {
  const {currentBlock, setHasGraphError, leavesRootBlockOfLastGraphRefresh, setLeafRootBlockLastGraphRefresh} =
    useContext(AppContext)
  const currentRoute = useCurrentRoute()
  const [graphBlockNumber, setGraphBlockNumber] = useState<number>()
  const [hasBlockError, setHasBlockError] = useState<boolean>(false)
  const [hasQueryError, setHasQueryError] = useState<boolean>(false)

  const {loading, error, data, refetch} = useQuery(QUERY, {skip, notifyOnNetworkStatusChange: true})

  useEffect(() => {
    if (!loading && currentBlock) {
      assertNonNullable(currentRoute)
      assertNonNullable(leavesRootBlockOfLastGraphRefresh)
      assertNonNullable(setLeafRootBlockLastGraphRefresh)

      // This is required for the specific case of the earn page, we can't rely on the currentRoute
      // since interactions that update `currentBlock` are triggered by other pages. Failing to call
      // `setLeafRootBlockLastGraphRefresh` will perpetually show the spinner.
      const route = leavesRootBlockOfLastGraphRefresh[currentRoute] ? currentRoute : EARN_ROUTE
      const rootBlockOfLastGraphRefresh = leavesRootBlockOfLastGraphRefresh[route]
      const rootBlockNumberOfRefresh: BlockInfo = {...currentBlock}
      if (!!rootBlockOfLastGraphRefresh && rootBlockNumberOfRefresh.number > rootBlockOfLastGraphRefresh.number) {
        refetch().then(() => setLeafRootBlockLastGraphRefresh(route, rootBlockNumberOfRefresh))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, loading])

  useEffect(() => {
    if (hasBlockError) {
      setHasGraphError?.(true)
    } else {
      setHasGraphError?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBlockError, hasQueryError])

  useEffect(() => {
    if (data) {
      const {_meta} = data
      assertNonNullable(_meta)
      assertNonNullable(_meta.block)
      setGraphBlockNumber(_meta.block.number)

      assertNonNullable(leavesRootBlockOfLastGraphRefresh)
      assertNonNullable(setLeafRootBlockLastGraphRefresh)
      assertNonNullable(currentRoute)
      const rootBlockOfLastGraphRefresh = leavesRootBlockOfLastGraphRefresh[currentRoute]
      if (!rootBlockOfLastGraphRefresh && currentBlock) {
        setLeafRootBlockLastGraphRefresh(currentRoute, currentBlock)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

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
