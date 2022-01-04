import {ApolloClient, InMemoryCache, NormalizedCacheObject} from "@apollo/client"
import {NetworkConfig} from "../types/network"

const API_URLS = {
  mainnet: "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch",
  localhost: "http://localhost:8000/subgraphs/name/goldfinch-subgraph",
}

const getApolloClient = (network: NetworkConfig | undefined): ApolloClient<NormalizedCacheObject> => {
  const networkName = network?.name || "mainnet"
  const uri = API_URLS[networkName]
  if (!uri) {
    console.error("On a not supported network, subgraph queries will not work")
  }

  return new ApolloClient({
    cache: new InMemoryCache(),
    uri: uri,
  })
}

export default getApolloClient
