import { Transaction } from "./graphql/generated";

type CorrespondingExistsInfo = {
  [timestamp: number]: {
    [txHash: string]: true;
  };
};

type OverlapAccumulator = {
  depositedAndStaked: CorrespondingExistsInfo;
  unstakedAndWithdrew: CorrespondingExistsInfo;
};

/**
 * Utility for filtering a set of Ethereum events indexed by the subgraph that may be "overlapping", i.e.
 * where the set may have more than one item pertaining to the same Ethereum transaction. This function
 * filters that set so that it is suitable for presenting to the user as their transaction history.
 * Currently, we define "suitable" to mean that the result set returned by this function contains only
 * one item pertaining to a given Ethereum transaction.
 * @param overlappingEvents The array of Transactions from the subgraph
 * @returns The same array of Transactions, but with overlapping events removed
 */
export function reduceOverlappingEventsToNonOverlappingTxs<
  T extends Pick<Transaction, "category" | "timestamp" | "transactionHash">
>(overlappingEvents: T[] | undefined): T[] {
  if (!overlappingEvents) {
    return [];
  }

  // We want to eliminate `Staked` events that are redundant with a corresponding
  // `DepositedAndStaked` event, and `Unstaked` events that are redundant with
  // a corresponding `UnstakedAndWithdrew` or `UnstakedAndWithdrewMultiple` event.
  //
  // Currently, in doing this we make an ASSUMPTION: that only one such redundant pair can have been
  // emitted in a given Ethereum transaction. In actuality, this assumption is not guaranteed
  // to be true, because there's nothing to stop someone from performing multiple stakings or unstakings
  // in one transaction using a multi-send contract. But the assumption is true for transactions created
  // using Goldfinch frontends, which is all we will worry about supporting here.

  const reduced: OverlapAccumulator =
    overlappingEvents.reduce<OverlapAccumulator>(
      (acc: OverlapAccumulator, curr: T) => {
        switch (curr.category) {
          case "SENIOR_POOL_DEPOSIT_AND_STAKE":
            acc.depositedAndStaked[curr.timestamp] =
              acc.depositedAndStaked[curr.timestamp] || {};
            acc.depositedAndStaked[curr.timestamp][curr.transactionHash] = true;
            break;
          case "SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL":
            acc.unstakedAndWithdrew[curr.timestamp] =
              acc.unstakedAndWithdrew[curr.timestamp] || {};
            acc.unstakedAndWithdrew[curr.timestamp][curr.transactionHash] =
              true;
            break;
          default:
            break;
        }
        return acc;
      },
      {
        depositedAndStaked: {},
        unstakedAndWithdrew: {},
      }
    );
  return overlappingEvents.filter((tx: T): boolean => {
    switch (tx.category) {
      case "SENIOR_POOL_STAKE":
        return !reduced.depositedAndStaked[tx.timestamp]?.[tx.transactionHash];
      case "SENIOR_POOL_UNSTAKE":
        return !reduced.unstakedAndWithdrew[tx.timestamp]?.[tx.transactionHash];
      default:
        return true;
    }
  });
}
