import {ApolloClient, InMemoryCache, NormalizedCacheObject} from "@apollo/client"
import {NetworkConfig} from "../types/network"

const API_URLS = {
  mainnet: "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch",
  localhost: "http://localhost:8000/subgraphs/name/goldfinch-subgraph",
}

const getApolloClient = (network: NetworkConfig | undefined): ApolloClient<NormalizedCacheObject> => {
  let networkName: string
  if (!network) {
    networkName = "mainnet"
  } else if (network.name === "localhost" && process.env.NODE_ENV === "production") {
    // Any private network is marked as localhost, check `mapNetworkToID`, for production we
    // want default to mainnet
    networkName = "mainnet"
  } else {
    networkName = network.name
  }

  const uri = API_URLS[networkName]
  if (!uri) {
    console.error("On a not supported network, subgraph queries will not work. Network: ", networkName)
  }

  return new ApolloClient({
    cache: new InMemoryCache(),
    uri: uri,
  })
}

export default getApolloClient
