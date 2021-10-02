import {ApolloClient, InMemoryCache} from "@apollo/client"

const apolloClient = new ApolloClient({
  uri: process.env.REACT_APP_GRAPHQL_QUERY_URL,
  cache: new InMemoryCache(),
})

export {apolloClient}
