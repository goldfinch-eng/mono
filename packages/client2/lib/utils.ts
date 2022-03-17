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

export async function waitForSubgraphBlock(minBlock: number) {
  let isSubgraphUpdated = false;
  while (!isSubgraphUpdated) {
    try {
      await apolloClient.query({
        query: MIN_BLOCK_CHECK,
        variables: { minBlock },
      });
      isSubgraphUpdated = true;
    } catch (e) {
      if (
        (e as Error).message.includes("has only indexed up to block number")
      ) {
        await wait(1000);
      } else {
        throw e;
      }
    }
  }
}
