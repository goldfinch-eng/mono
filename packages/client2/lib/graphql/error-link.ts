// Not to be confused with the non-fatal error link. This is a more typical Apollo error handling link, which we're just using to report errors to Sentry
// https://www.apollographql.com/docs/react/api/link/apollo-link-error/

import { onError } from "@apollo/client/link/error";
import * as Sentry from "@sentry/nextjs";

export const errorLink = onError(
  ({ graphQLErrors, networkError, operation }) => {
    // Don't report errors in the MinBlockCheck, it's intended to error
    if (operation.operationName === "MinBlockCheck") {
      return;
    }
    if (graphQLErrors) {
      graphQLErrors.forEach((graphQLError) => {
        // Strangely, Sentry won't interpret a GraphQLError type as an Error so you can't really use captureException() properly
        Sentry.captureException(
          new Error(
            `GraphQL error during operation \`${operation.operationName}\`: ${graphQLError.message}`
          )
        );
      });
    }
    if (networkError) {
      Sentry.captureException(networkError);
    }
  }
);
