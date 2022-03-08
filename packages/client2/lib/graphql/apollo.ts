import { ApolloClient, InMemoryCache } from "@apollo/client";

import { typePolicies } from "./type-policies";

export const apolloClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  cache: new InMemoryCache({ typePolicies }),
});
