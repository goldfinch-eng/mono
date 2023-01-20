import { gql } from "@apollo/client";
import { useEffect, useState } from "react";

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

export type ApolloClientError = {
  reason: string;
};
export function handleApolloClientError(e: ApolloClientError) {
  const reason = e.reason;
  const actualReason = reason.match(/reverted with reason string \'(.+)\'/);
  if (actualReason) {
    throw new Error(actualReason[1]);
  }
  throw e;
}

export function usePoller({
  callback,
  delay = 1000,
  maxPollingAttempts = 10,
  onMaxPoll,
}: {
  callback: () => Promise<"CONTINUE_POLLING" | "FINISH_POLLING">;
  delay: number;
  maxPollingAttempts?: number;
  onMaxPoll?: () => void;
}) {
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setIsPolling(true);
    let numAttempts = 0;
    const interval = setInterval(async () => {
      const callbackResult = await callback();
      numAttempts += 1;
      if (numAttempts >= maxPollingAttempts) {
        clearInterval(interval);
        setIsPolling(false);
        onMaxPoll?.();
      } else if (callbackResult === "FINISH_POLLING") {
        clearInterval(interval);
        setIsPolling(false);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [callback, delay, maxPollingAttempts, onMaxPoll]);

  return { isPolling };
}

class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableError";
  }
}

/**
 * A utility function that helps create exhaustive switch statements. Use this function as the `default` switch case, and pass the switch key as the arg here.
 * If the compiler shows an error at the callsite, then it means the switch statement is not exhaustive.
 * @param x The switch key
 */
export function assertUnreachable(x: never): never {
  throw new UnreachableError(
    `Expected not to get here.${
      x ? ` Unhandled switch key: ${x as string}` : ""
    }`
  );
}
