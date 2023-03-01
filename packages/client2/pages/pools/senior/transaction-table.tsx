import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/future/image";
import { useCallback } from "react";

import { Address } from "@/components/address";
import { Link, Table, goldfinchLogoPngUrl } from "@/components/design-system";
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
          SENIOR_POOL_DISTRIBUTION
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
        ENSName @client
        ENSAvatar @client
      }
      timestamp
      category
      sentAmount
      sentToken
      receivedAmount
      receivedToken
      tranchedPool {
        id
        name @client
        borrowerName @client
        borrowerLogo @client
      }
    }
  }
`;

const subtractiveIconTransactionCategories = new Set<TransactionCategory>([
  "SENIOR_POOL_WITHDRAWAL",
  "SENIOR_POOL_UNSTAKE",
  "SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL",
  "TRANCHED_POOL_DRAWDOWN",
  "SENIOR_POOL_DISTRIBUTION",
]);

const sentTokenCategories = new Set<TransactionCategory>([
  "SENIOR_POOL_STAKE",
  "SENIOR_POOL_DEPOSIT_AND_STAKE",
  "TRANCHED_POOL_REPAYMENT",
  "SENIOR_POOL_DISTRIBUTION",
]);

export function TransactionTable() {
  // ! This query defies the one-query-per-page pattern, but sadly it's necessary because Apollo has trouble with nested fragments. So sending the above as a nested fragment causes problems.
  const { data, error, fetchMore } = useBorrowerTransactionsQuery({
    variables: { first: 10, skip: 0 },
  });

  const filteredTxs = reduceOverlappingEventsToNonOverlappingTxs(
    data?.transactions
  );

  const transactions = filteredTxs.map((transaction) => {
    const date = new Date(transaction.timestamp * 1000);

    let tokenToDisplay = transaction.receivedToken;
    let amountToDisplay = transaction.receivedAmount;

    if (sentTokenCategories.has(transaction.category)) {
      tokenToDisplay = transaction.sentToken;
      amountToDisplay = transaction.sentAmount;
    }

    const transactionAmount =
      tokenToDisplay && amountToDisplay
        ? (subtractiveIconTransactionCategories.has(transaction.category)
            ? "-"
            : "+") +
          formatCrypto(
            {
              token: tokenToDisplay,
              amount: amountToDisplay,
            },
            { includeToken: true }
          )
        : null;

    return [
      <div key={`${transaction.id}-user`} className="flex items-center gap-2">
        {transaction.category === "TRANCHED_POOL_DRAWDOWN" ||
        transaction.category === "TRANCHED_POOL_REPAYMENT" ? (
          <>
            {transaction.tranchedPool?.borrowerLogo ? (
              <Image
                src={transaction.tranchedPool?.borrowerLogo as string}
                width={24}
                height={24}
                className="shrink-0 overflow-hidden rounded-full"
                alt=""
              />
            ) : (
              <div
                style={{ width: "24px", height: "24px" }}
                className="shrink-0 rounded-full"
              />
            )}
            <div>{transaction.tranchedPool?.borrowerName}</div>
          </>
        ) : transaction.category === "SENIOR_POOL_DISTRIBUTION" ? (
          <>
            <Image
              src={goldfinchLogoPngUrl}
              width={24}
              height={24}
              className="shrink-0 overflow-hidden rounded-full"
              alt=""
            />
            <div>Goldfinch Protocol</div>
          </>
        ) : (
          <Address
            address={transaction.user.id}
            ENSName={transaction.user.ENSName}
            ENSAvatar={transaction.user.ENSAvatar}
          />
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
      <h2 className="mb-6 font-semibold">Recent activity</h2>
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
