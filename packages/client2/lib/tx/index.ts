import { ArrayItem, assertUnreachable } from "../../types/utils";
import {
  AmountToken,
  BorrowerTransactionsQuery,
  CurrentUserTransactionsQuery,
  CurrentUserWalletInfoQuery,
  SupportedCrypto,
  TranchedPoolTransactionTableQuery,
  TransactionCategory,
} from "../graphql/generated";

type CorrespondingExistsInfo = {
  [timestamp: number]: {
    [txId: string]: true;
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
 */
export function reduceOverlappingEventsToNonOverlappingTxs<
  // It would be stronger to type this as `T extends CurrentUserTransactionsQuery["transactions"] | ...`, so
  // that the compiler understands that `overlappingEvents` can only be an array of a single type of item,
  // but the compiler resisted that with the use of `.reduce()`.
  T extends
    | ArrayItem<CurrentUserWalletInfoQuery>["transactions"]
    | ArrayItem<CurrentUserTransactionsQuery["transactions"]>
    | ArrayItem<BorrowerTransactionsQuery["transactions"]>
    | ArrayItem<TranchedPoolTransactionTableQuery["transactions"]>
>(overlappingEvents: T[]): T[] {
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
          case TransactionCategory.SeniorPoolDeposit:
            break;
          case TransactionCategory.SeniorPoolDepositAndStake:
            acc.depositedAndStaked[curr.timestamp] =
              acc.depositedAndStaked[curr.timestamp] || {};
            acc.depositedAndStaked[curr.timestamp][curr.transactionHash] = true;
            break;
          case TransactionCategory.SeniorPoolRedemption:
          case TransactionCategory.SeniorPoolStake:
            break;
          case TransactionCategory.SeniorPoolUnstake:
            break;
          case TransactionCategory.SeniorPoolUnstakeAndWithdrawal:
            acc.unstakedAndWithdrew[curr.timestamp] =
              acc.unstakedAndWithdrew[curr.timestamp] || {};
            acc.unstakedAndWithdrew[curr.timestamp][curr.transactionHash] =
              true;
            break;
          case TransactionCategory.SeniorPoolWithdrawal:
          case TransactionCategory.TranchedPoolDeposit:
          case TransactionCategory.TranchedPoolDrawdown:
          case TransactionCategory.TranchedPoolRepayment:
          case TransactionCategory.TranchedPoolWithdrawal:
          case TransactionCategory.UidMinted:
            break;
          default:
            assertUnreachable(curr.category);
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
      case TransactionCategory.SeniorPoolDeposit:
      case TransactionCategory.SeniorPoolDepositAndStake:
      case TransactionCategory.SeniorPoolRedemption:
        return true;
      case TransactionCategory.SeniorPoolStake:
        return !reduced.depositedAndStaked[tx.timestamp]?.[tx.transactionHash];
      case TransactionCategory.SeniorPoolUnstake:
        return !reduced.unstakedAndWithdrew[tx.timestamp]?.[tx.transactionHash];
      case TransactionCategory.SeniorPoolUnstakeAndWithdrawal:
      case TransactionCategory.SeniorPoolWithdrawal:
      case TransactionCategory.TranchedPoolDeposit:
      case TransactionCategory.TranchedPoolDrawdown:
      case TransactionCategory.TranchedPoolRepayment:
      case TransactionCategory.TranchedPoolWithdrawal:
      case TransactionCategory.UidMinted:
        return true;
      default:
        return assertUnreachable(tx.category);
    }
  });
}

export const supportedCryptoTokenByTxAmountToken: Record<
  AmountToken,
  SupportedCrypto
> = {
  USDC: SupportedCrypto.Usdc,
  FIDU: SupportedCrypto.Fidu,
  CURVE_LP: SupportedCrypto.CurveLp,
};
