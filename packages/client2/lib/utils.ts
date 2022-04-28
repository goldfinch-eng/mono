import { gql } from "@apollo/client";

import { apolloClient } from "@/lib/graphql/apollo";

/**
 * Simple helper that provides a convenient way to wait for n milliseconds in an async function.
 */
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_BLOCK_CHECK = gql`
  query MinBlockCheck($minBlock: Int!) {
    _meta(block: { number_gte: $minBlock }) {
      deployment
    }
  }
`;

export async function waitForSubgraphBlock(
  minBlock: number,
  maxPollingAttempts = 30
) {
  let isSubgraphUpdated = false;
  let currentAttempt = 1;
  while (!isSubgraphUpdated && currentAttempt <= maxPollingAttempts) {
    try {
      await apolloClient.query({
        query: MIN_BLOCK_CHECK,
        variables: { minBlock },
        errorPolicy: "none",
      });
      isSubgraphUpdated = true;
    } catch (e) {
      if (
        (e as Error).message.includes("has only indexed up to block number")
      ) {
        currentAttempt += 1;
        await wait(1000);
      } else {
        throw e;
      }
    }
  }
  if (currentAttempt >= maxPollingAttempts) {
    throw new Error("MAX_POLLING_ATTEMPTS");
  }
}
