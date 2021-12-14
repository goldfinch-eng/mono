import {useState, useEffect, useContext} from "react"
import {AppContext} from "../App"
import {useLazyQuery, ApolloQueryResult, QueryLazyOptions} from "@apollo/client"
import {getSeniorPoolAndProviders, getSeniorPoolAndProvidersVariables} from "../graphql/types"

type GetGraphDataAndProviders = getSeniorPoolAndProviders
type GetGraphDataAndProvidersVariables = getSeniorPoolAndProvidersVariables

interface UseGraphQuerierReturnValue {
  data?: GetGraphDataAndProviders
  fetchGraphData: (options?: QueryLazyOptions<getSeniorPoolAndProvidersVariables> | undefined) => void
  setGraphBlockNumber: React.Dispatch<React.SetStateAction<number | undefined>>
  refetch?:
    | ((
        variables?: Partial<getSeniorPoolAndProvidersVariables> | undefined
      ) => Promise<ApolloQueryResult<getSeniorPoolAndProviders>>)
    | undefined
}

export function useGraphQuerier(graphQuery, setGraphData): UseGraphQuerierReturnValue {
  const {networkMonitor, setHasGraphError} = useContext(AppContext)
  const [graphBlockNumber, setGraphBlockNumber] = useState<number>()
  const [hasBlockError, setHasBlockError] = useState<boolean>(false)
  const [hasQueryError, setHasQueryError] = useState<boolean>(false)

  const [fetchGraphData, {data, error, refetch}] = useLazyQuery<
    GetGraphDataAndProviders,
    GetGraphDataAndProvidersVariables
  >(graphQuery, {fetchPolicy: "no-cache"})

  useEffect(() => {
    if (hasBlockError || hasQueryError) {
      setHasGraphError?.(true)
    } else {
      setHasGraphError?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBlockError, hasQueryError])

  useEffect(() => {
    if (hasBlockError) {
      setHasBlockError(false)
    }
    if (
      networkMonitor?.currentBlockNumber &&
      graphBlockNumber &&
      graphBlockNumber + 10 < networkMonitor?.currentBlockNumber
    ) {
      console.error(`
        [The Graph] Block ingestor lagging behind: Block number is out of date.
        The latest block is ${networkMonitor?.currentBlockNumber}, 
        but The Graph API returned ${graphBlockNumber}.`)
      setHasBlockError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphBlockNumber])

  useEffect(() => {
    if (hasQueryError) {
      setHasQueryError(false)
    }
    if (data) {
      setGraphData()
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
  }, [data, error])

  return {data, fetchGraphData, setGraphBlockNumber, refetch}
}

export default useGraphQuerier
