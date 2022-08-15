import { gql } from "@apollo/client";
import { format } from "date-fns";
import { useCallback } from "react";

import { Link, ShimmerLines, Table, Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  useCurrentUserTransactionsQuery,
  TransactionCategory,
} from "@/lib/graphql/generated";
import { getTransactionLabel, getTransactionIcon } from "@/lib/pools";
import { reduceOverlappingEventsToNonOverlappingTxs } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserTransactions($account: String!, $first: Int!, $skip: Int!) {
    transactions(
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
      where: { user: $account }
    ) {
      id
      transactionHash
      category
      amount
      amountToken
      timestamp
      tranchedPool {
        id
      }
    }
  }
`;

const subtractiveIconTransactionCategories = [
  TransactionCategory.SeniorPoolRedemption,
  TransactionCategory.SeniorPoolUnstake,
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

  const filteredTxs = reduceOverlappingEventsToNonOverlappingTxs(
    data?.transactions
  );

  const rows = filteredTxs.map((transaction) => {
    const amount =
      transaction.amount && !transaction.amount.isZero()
        ? (subtractiveIconTransactionCategories.includes(transaction.category)
            ? "-"
            : "+") +
          formatCrypto(
            {
              token: transaction.amountToken,
              amount: transaction.amount,
            },
            { includeToken: true }
          )
        : null;

    const date = new Date(transaction.timestamp * 1000);

    return [
      <div
        key={`${transaction.id}-category`}
        className="flex items-center gap-3 text-left"
      >
        <Icon name={getTransactionIcon(transaction)} size="sm" />
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
  });

  const onScrollBottom = useCallback(() => {
    if (data?.transactions) {
      fetchMore({
        variables: {
          skip: data?.transactions.length,
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
  ) : !account ? (
    <div className="text-clay-500">Wallet not connected</div>
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
