import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/image";
import { useCallback } from "react";

import { Icon, Link, Table } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  TransactionCategory,
  useBorrowerTransactionsQuery,
} from "@/lib/graphql/generated";

gql`
  query BorrowerTransactions($first: Int!, $skip: Int!) {
    transactions(
      where: { category_in: [TRANCHED_POOL_DRAWDOWN, TRANCHED_POOL_REPAYMENT] }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      timestamp
      amount
      category
      tranchedPool {
        id
        name @client
        icon @client
      }
    }
  }
`;

export function RecentRepaymentsTable() {
  // ! This query defies the one-query-per-page pattern, but sadly it's necessary because Apollo has trouble with nested fragments. So sending the above as a nested fragment causes problems.
  const { data, error, fetchMore } = useBorrowerTransactionsQuery({
    variables: { first: 20, skip: 0 },
  });

  const transactions =
    data?.transactions.map((transaction) => {
      const date = new Date(transaction.timestamp * 1000);
      const transactionAmount = formatCrypto(
        {
          token: SupportedCrypto.Usdc,
          amount:
            transaction.category === TransactionCategory.TranchedPoolDrawdown
              ? transaction.amount.mul(-1)
              : transaction.amount,
        },
        { includeSymbol: true }
      );

      return [
        <div key={`${transaction.id}-user`} className="flex items-center gap-2">
          <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
            {transaction.tranchedPool?.icon ? (
              <Image
                src={transaction.tranchedPool.icon as string}
                layout="fill"
                sizes="24px"
                alt=""
              />
            ) : null}
          </div>
          <Link href={`/pools/${transaction.tranchedPool?.id}`}>
            {transaction.tranchedPool?.name ?? "Unnamed Pool"}
          </Link>
        </div>,
        <div key={`${transaction.id}-amount`} className="text-right">
          {transactionAmount}
        </div>,
        <a
          href={`https://etherscan.io/tx/${transaction.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-end gap-3 hover:underline"
          key={`${transaction.id}-timestamp`}
        >
          {format(date, "MMMM d, y")}
          <Icon name="ArrowTopRight" size="sm" />
        </a>,
      ];
    }) ?? [];

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

  return (
    <div>
      <h2 className="mb-8 text-3xl">Recent Borrower Transactions</h2>
      {error ? (
        <div className="text-clay-500">
          Unable to fetch recent transactions. {error}
        </div>
      ) : (
        <Table
          headings={["Borrower", "Amount", "Date"]}
          hideHeadings
          rows={transactions}
          onScrollBottom={onScrollBottom}
        />
      )}
    </div>
  );
}
