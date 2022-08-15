import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/image";
import { useCallback } from "react";

import { Address } from "@/components/address";
import { Link, Table } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  TransactionCategory,
  useBorrowerTransactionsQuery,
} from "@/lib/graphql/generated";
import { getShortTransactionLabel } from "@/lib/pools";
import { reduceOverlappingEventsToNonOverlappingTxs } from "@/lib/tx";

gql`
  query BorrowerTransactions($first: Int!, $skip: Int!) {
    transactions(
      where: {
        category_in: [
          TRANCHED_POOL_DRAWDOWN
          TRANCHED_POOL_REPAYMENT
          SENIOR_POOL_DEPOSIT
          SENIOR_POOL_DEPOSIT_AND_STAKE
          SENIOR_POOL_STAKE
          SENIOR_POOL_WITHDRAWAL
          SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL
          SENIOR_POOL_UNSTAKE
        ]
      }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      transactionHash
      user {
        id
      }
      timestamp
      amount
      amountToken
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

const subtractiveIconTransactionCategories = [
  TransactionCategory.SeniorPoolWithdrawal,
  TransactionCategory.SeniorPoolUnstake,
  TransactionCategory.SeniorPoolUnstakeAndWithdrawal,
  TransactionCategory.TranchedPoolDrawdown,
];

export function TransactionTable() {
  // ! This query defies the one-query-per-page pattern, but sadly it's necessary because Apollo has trouble with nested fragments. So sending the above as a nested fragment causes problems.
  const { data, error, fetchMore } = useBorrowerTransactionsQuery({
    variables: { first: 20, skip: 0 },
  });

  const filteredTxs = reduceOverlappingEventsToNonOverlappingTxs(
    data?.transactions
  );

  const transactions = filteredTxs.map((transaction) => {
    const date = new Date(transaction.timestamp * 1000);
    const transactionAmount =
      (subtractiveIconTransactionCategories.includes(transaction.category)
        ? "-"
        : "+") +
      formatCrypto(
        {
          token: transaction.amountToken,
          amount: transaction.amount,
        },
        { includeToken: true }
      );

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
          <Address address={transaction.user.id} />
        )}
      </div>,
      <div key={`${transaction.id}-category`} className="text-left">
        {getShortTransactionLabel(transaction)}
      </div>,
      <div key={`${transaction.id}-amount`} className="text-right">
        {transactionAmount}
      </div>,
      <div key={`${transaction.id}-date`} className="text-right">
        {format(date, "MMM d, y")}
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
        href={`https://etherscan.io/tx/${transaction.transactionHash}`}
        target="_blank"
        rel="noopener noreferrer"
        key={`${transaction.id}-tx`}
        iconRight="ArrowTopRight"
        className="text-sand-400"
      >
        Tx
      </Link>,
    ];
  });

  const onScrollBottom = useCallback(() => {
    if (data?.transactions) {
      fetchMore({
        variables: {
          skip: data.transactions.length,
          first: 20,
        },
      });
    }
  }, [data, fetchMore]);

  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">Recent activity</h2>
      {error ? (
        <div className="text-clay-500">
          Unable to fetch recent transactions. {error.message}
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
          fixedHeight
        />
      )}
    </div>
  );
}
