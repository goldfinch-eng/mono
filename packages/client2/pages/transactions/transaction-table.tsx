import { gql } from "@apollo/client";
import { format } from "date-fns";
import { useCallback } from "react";

import { Link, ShimmerLines, Table } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  useCurrentUserTransactionsQuery,
  TransactionCategory,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { getTransactionLabel } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserTransactions($account: ID!, $first: Int!, $skip: Int!) {
    user(id: $account) {
      transactions(
        orderBy: timestamp
        orderDirection: desc
        first: $first
        skip: $skip
      ) {
        id
        transactionHash
        category
        amount
        timestamp
        tranchedPool {
          id
        }
      }
    }
  }
`;

const subtractiveTransactionCategories = [
  TransactionCategory.SeniorPoolRedemption,
  TransactionCategory.SeniorPoolUnstakeAndWithdrawal,
  TransactionCategory.SeniorPoolWithdrawal,
  TransactionCategory.TranchedPoolDrawdown,
  TransactionCategory.TranchedPoolWithdrawal,
];

export function TransactionTable() {
  const { account } = useWallet();
  const { data, error, fetchMore, loading } = useCurrentUserTransactionsQuery({
    variables: {
      account: account?.toLowerCase() ?? "",
      first: 20,
      skip: 0,
    },
  });

  const rows =
    data?.user?.transactions.map((transaction) => {
      const amount =
        transaction.amount && !transaction.amount.isZero()
          ? (subtractiveTransactionCategories.includes(transaction.category)
              ? "-"
              : "+") +
            formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: transaction.amount,
            })
          : null;

      const date = new Date(transaction.timestamp * 1000);

      return [
        <div key={`${transaction.id}-category`} className="text-left">
          {getTransactionLabel(transaction)}
        </div>,
        <div key={`${transaction.id}-amount`} className="text-left">
          {amount}
        </div>,
        <div key={`${transaction.id}-date`} className="text-left">
          {format(date, "MMM d, y")}
        </div>,
        <div key={`${transaction.id}-pool`} className="text-left">
          {transaction.tranchedPool ? (
            <Link
              href={`/pools/${transaction.tranchedPool.id}`}
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              Pool
            </Link>
          ) : null}
        </div>,
        <Link
          href={`https://etherscan.io/tx/${transaction.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sand-400"
          key={`${transaction.id}-link`}
          iconRight="ArrowTopRight"
        >
          Tx
        </Link>,
      ];
    }) ?? [];

  const onScrollBottom = useCallback(() => {
    if (data?.user?.transactions) {
      fetchMore({
        variables: {
          skip: data?.user?.transactions.length,
          first: 20,
        },
      });
    }
  }, [data, fetchMore]);

  return loading ? (
    <ShimmerLines lines={4} truncateFirstLine={false} />
  ) : error ? (
    <div className="text-clay-500">
      There was an error fetching transactions: {error.message}
    </div>
  ) : rows.length === 0 ? (
    <div className="rounded bg-sand-50 p-3 text-center text-sm text-sand-400">
      No recent activity
    </div>
  ) : (
    <Table
      headings={["Type", "Amount", "Date", "Link", ""]}
      rows={rows}
      onScrollBottom={onScrollBottom}
    />
  );
}
