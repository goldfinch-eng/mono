import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/image";
import { useCallback } from "react";

import { Link, Table } from "@/components/design-system";
import { Identicon } from "@/components/identicon";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  TransactionCategory,
  useBorrowerTransactionsQuery,
} from "@/lib/graphql/generated";

gql`
  query BorrowerTransactions($first: Int!, $skip: Int!) {
    transactions(
      where: {
        category_in: [
          TRANCHED_POOL_DRAWDOWN
          TRANCHED_POOL_REPAYMENT
          SENIOR_POOL_DEPOSIT
          SENIOR_POOL_WITHDRAWAL
        ]
      }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      user {
        id
      }
      timestamp
      amount
      category
      tranchedPool {
        id
        name @client
        icon @client
        borrower @client {
          name
          logo
        }
      }
    }
  }
`;

export function TransactionTable() {
  // ! This query defies the one-query-per-page pattern, but sadly it's necessary because Apollo has trouble with nested fragments. So sending the above as a nested fragment causes problems.
  const { data, error, fetchMore } = useBorrowerTransactionsQuery({
    variables: { first: 20, skip: 0 },
  });

  const transactions =
    data?.transactions.map((transaction) => {
      const date = new Date(transaction.timestamp * 1000);
      const transactionAmount = formatCrypto({
        token: SupportedCrypto.Usdc,
        amount: transaction.amount,
      });

      return [
        <div key={`${transaction.id}-user`} className="flex items-center gap-2">
          {transaction.category === TransactionCategory.TranchedPoolDrawdown ||
          transaction.category === TransactionCategory.TranchedPoolRepayment ? (
            <>
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={transaction.tranchedPool?.icon as string}
                  layout="fill"
                  sizes="24px"
                  alt=""
                />
              </div>
              <div>{transaction.tranchedPool?.borrower.name}</div>
            </>
          ) : (
            <>
              <Identicon className="h-6 w-6" account={transaction.user.id} />
              <div>
                {transaction.user.id.substring(0, 6)}...
                {transaction.user.id.substring(transaction.user.id.length - 4)}
              </div>
            </>
          )}
        </div>,
        <div key={`${transaction.id}-category`}>
          {transaction.category === TransactionCategory.SeniorPoolDeposit
            ? "Supply"
            : transaction.category === TransactionCategory.SeniorPoolWithdrawal
            ? "Withdrawal"
            : transaction.category === TransactionCategory.TranchedPoolDrawdown
            ? "Drawdown"
            : transaction.category === TransactionCategory.TranchedPoolRepayment
            ? "Repayment"
            : null}
        </div>,
        <div key={`${transaction.id}-amount`} className="text-right">
          {transactionAmount}
        </div>,
        <div key={`${transaction.id}-date`} className="text-right">
          {format(date, "MMMM d, y")}
        </div>,
        transaction.tranchedPool ? (
          <Link
            href={`/pools/${transaction.tranchedPool.id}`}
            iconRight="ArrowTopRight"
            className="text-sand-400"
          >
            Pool
          </Link>
        ) : null,
        <Link
          href={`https://etherscan.io/tx/${transaction.id}`}
          target="_blank"
          rel="noopener noreferrer"
          key={`${transaction.id}-tx`}
          iconRight="ArrowTopRight"
          className="text-sand-400"
        >
          Tx
        </Link>,
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
      <h3 className="mb-4 text-lg font-semibold">Recent activity</h3>
      {error ? (
        <div className="text-clay-500">
          Unable to fetch recent transactions. {error}
        </div>
      ) : (
        <Table
          headings={[
            "User",
            "Category",
            "Amount",
            "Date",
            "Pool",
            "Transaction",
          ]}
          hideHeadings
          rows={transactions}
          onScrollBottom={onScrollBottom}
        />
      )}
    </div>
  );
}
