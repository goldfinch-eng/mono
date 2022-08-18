import { ApolloClient, InMemoryCache, from, HttpLink } from "@apollo/client";
import { withScalars } from "apollo-link-scalars";
import { buildClientSchema, IntrospectionQuery } from "graphql";

import localSchema from "./client-only-schema.graphql";
import { errorLink } from "./error-link";
import { resolvers } from "./local-resolvers";
import { nonFatalErrorLink } from "./non-fatal-error-link";
import introspectionResult from "./schema.json";
import { typePolicies } from "./type-policies";
import { typesMap } from "./types-map";

const graphQlApiUrl =
  typeof process.env.NEXT_PUBLIC_GRAPHQL_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch-v2"
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:8000/subgraphs/name/goldfinch-subgraph"
    : null;
if (!graphQlApiUrl) {
  throw new Error("Could not determine GraphQL API URL");
}
const httpLink = new HttpLink({ uri: graphQlApiUrl });

const schema = buildClientSchema(
  introspectionResult as unknown as IntrospectionQuery
);
const scalarLink = withScalars({ schema, typesMap });

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies,
    possibleTypes: { GfiGrant: ["IndirectGfiGrant", "DirectGfiGrant"] },
  }),
  typeDefs: localSchema,
  link: from([scalarLink, nonFatalErrorLink, errorLink, httpLink]),
  defaultOptions: {
    watchQuery: {
      errorPolicy: "all",
    },
    query: {
      errorPolicy: "all",
    },
  },
  resolvers,
});
