import {
  ApolloClient,
  InMemoryCache,
  from,
  createHttpLink,
} from "@apollo/client";
import { MultiAPILink } from "@habx/apollo-multi-endpoint-link";
import { withScalars } from "apollo-link-scalars";
import { buildClientSchema, IntrospectionQuery } from "graphql";

import { CMS_API_URL, SUBGRAPH_API_URL } from "@/constants";

import localSchema from "./client-only-schema.graphql";
import { errorLink } from "./error-link";
import { resolvers } from "./local-resolvers";
import { nonFatalErrorLink } from "./non-fatal-error-link";
import introspectionResult from "./schema.json";
import { typePolicies } from "./type-policies";
import { typesMap } from "./types-map";

const multiHttpLink = new MultiAPILink({
  endpoints: {
    subgraph: SUBGRAPH_API_URL,
    cms: CMS_API_URL,
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
