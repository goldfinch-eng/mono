import { ApolloClient, InMemoryCache, from, HttpLink } from "@apollo/client";
import { withScalars } from "apollo-link-scalars";
import { buildClientSchema, IntrospectionQuery } from "graphql";

import localSchema from "./client-only-schema.graphql";
import { nonFatalErrorLink } from "./non-fatal-error-link";
import introspectionResult from "./schema.json";
import { typePolicies } from "./type-policies";
import { typesMap } from "./types-map";

const httpLink = new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL });

const schema = buildClientSchema(
  introspectionResult as unknown as IntrospectionQuery
);
const scalarLink = withScalars({ schema, typesMap });

export const apolloClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  cache: new InMemoryCache({ typePolicies }),
  typeDefs: localSchema,
  link: from([scalarLink, nonFatalErrorLink, httpLink]),
  defaultOptions: {
    watchQuery: {
      errorPolicy: "all",
    },
    query: {
      errorPolicy: "all",
    },
  },
});
