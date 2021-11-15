import {ApolloClient, InMemoryCache, NormalizedCacheObject} from "@apollo/client"
import {NetworkConfig} from "../App"

const API_URLS = {
  mainnet: "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch",
  localhost: "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch",
}

const getApolloClient = (network?: NetworkConfig): ApolloClient<NormalizedCacheObject> => {
  const networkName = network?.name || "mainnet"

  return new ApolloClient({
    cache: new InMemoryCache(),
    uri: API_URLS[networkName],
  })
}

export default getApolloClient
