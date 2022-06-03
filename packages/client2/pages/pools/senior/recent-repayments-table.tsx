import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/image";
import { useCallback } from "react";

import { Icon, Link, Table } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  useBorrowerTransactionsQuery,
} from "@/lib/graphql/generated";

gql`
  query BorrowerTransactions($first: Int!, $skip: Int!) {
    tranchedPoolTransactions(
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      __typename
      id
      timestamp
      ... on TranchedPoolDrawdownMadeTransaction {
        amount
      }
      ... on TranchedPoolPaymentAppliedTransaction {
        reserveAmount
        interestAmount
        principalAmount
        remainingAmount
      }
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
    data?.tranchedPoolTransactions.map((transaction, index) => {
      const date = new Date(transaction.timestamp.toNumber() * 1000);
      const transactionAmount = formatCrypto(
        {
          token: SupportedCrypto.Usdc,
          amount:
            transaction.__typename === "TranchedPoolDrawdownMadeTransaction"
              ? transaction.amount.mul(-1)
              : transaction.principalAmount
                  .add(transaction.interestAmount)
                  .add(transaction.reserveAmount)
                  .add(transaction.remainingAmount),
        },
        { includeSymbol: true }
      );

      return [
        <div key={index} className="flex items-center gap-2">
          <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
            {transaction.tranchedPool.icon ? (
              <Image
                src={transaction.tranchedPool.icon as string}
                layout="fill"
                sizes="24px"
                alt=""
              />
            ) : null}
          </div>
          <Link href={`/pools/${transaction.tranchedPool.id}`}>
            {transaction.tranchedPool.name ?? ""}
          </Link>
        </div>,
        <div key={index} className="text-right">
          {transactionAmount}
        </div>,
        <a
          href={`https://etherscan.io/tx/${transaction.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-end gap-3 hover:underline"
          key={index}
        >
          {format(date, "MMMM d, y")}
          <Icon name="ArrowTopRight" size="sm" />
        </a>,
      ];
    }) ?? [];

  const onScrollBottom = useCallback(() => {
    if (data?.tranchedPoolTransactions) {
      fetchMore({
        variables: {
          skip: data?.tranchedPoolTransactions.length,
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
