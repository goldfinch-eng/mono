import {
  ApolloClient,
  InMemoryCache,
  from,
  createHttpLink,
} from "@apollo/client";
import { MultiAPILink } from "@habx/apollo-multi-endpoint-link";
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

const cmsApiUrl =
  typeof process.env.NEXT_PUBLIC_CMS_GRAPHQL_API_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_CMS_GRAPHQL_API_URL
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "http://cms.goldfinch.finance/api/graphql"
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:3010/api/graphql"
    : null;
if (!cmsApiUrl) {
  throw new Error("Could not determine CMS API URL");
}

const multiHttpLink = new MultiAPILink({
  endpoints: {
    subgraph: graphQlApiUrl,
    cms: cmsApiUrl,
  },
  defaultEndpoint: "subgraph",
  httpSuffix: "", // required, otherwise adds /graphql by default
  createHttpLink: () => createHttpLink(),
  getContext: (endpoint) => {
    if (endpoint === "cms") {
      return {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    }
    return {};
  },
});

const schema = buildClientSchema(
  introspectionResult as unknown as IntrospectionQuery
);
const scalarLink = withScalars({ schema, typesMap });

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies,
    possibleTypes: {
      GfiGrant: ["IndirectGfiGrant", "DirectGfiGrant"],
      Loan: ["TranchedPool", "CallableLoan"],
    },
  }),
  typeDefs: localSchema,
  link: from([scalarLink, nonFatalErrorLink, errorLink, multiHttpLink]),
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
