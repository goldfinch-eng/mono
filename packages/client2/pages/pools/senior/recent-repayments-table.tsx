import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/image";

import { Icon, Table } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  useAllBorrowerTransactionsQuery,
} from "@/lib/graphql/generated";

gql`
  query AllBorrowerTransactions {
    tranchedPools {
      id
      createdAt
    }
    tranchedPoolTransactions(
      orderBy: timestamp
      orderDirection: desc
      first: 20
      skip: 0
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

const BorrowerTransactionsDocument = gql`
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
      }
    }
  }
`;

// export const TRANSACTION_TABLE_FIELDS = gql`
//   fragment
// `;

export function RecentRepaymentsTable() {
  const { data, error, fetchMore } = useAllBorrowerTransactionsQuery();

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
          <div className="relative h-6 w-6 overflow-hidden rounded-full">
            {transaction.tranchedPool.icon ? (
              <Image
                src={transaction.tranchedPool.icon as string}
                layout="fill"
                sizes="24px"
                alt=""
              />
            ) : null}
          </div>
          {transaction.tranchedPool.name}
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
        />
      )}

      <button
        onClick={() =>
          fetchMore({
            query: BorrowerTransactionsDocument,
            variables: {
              skip: data?.tranchedPoolTransactions.length,
              first: 20,
            },
          })
        }
      >
        moar
      </button>
    </div>
  );
}
