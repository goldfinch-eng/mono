import { gql } from "@apollo/client";
import { format } from "date-fns";
import { useCallback } from "react";

import { Link, ShimmerLines, Table, Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  useCurrentUserTransactionsQuery,
  TransactionCategory,
  SupportedCrypto,
  SupportedNft,
} from "@/lib/graphql/generated";
import { getTransactionLabel, getTransactionIcon } from "@/lib/pools";
import { reduceOverlappingEventsToNonOverlappingTxs } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";

import { FormatWithIcon } from "./format-with-icon";

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
      sentAmount
      sentToken
      sentNftId
      sentNftType
      receivedAmount
      receivedToken
      receivedNftId
      receivedNftType
      fiduPrice
      timestamp
      tranchedPool {
        id
      }
    }
  }
`;

const curvePoolCategories = [
  TransactionCategory.CurveFiduBuy,
  TransactionCategory.CurveFiduSell,
];

const seniorPoolCategories = [
  TransactionCategory.SeniorPoolDeposit,
  TransactionCategory.SeniorPoolDepositAndStake,
  TransactionCategory.SeniorPoolStake,
  TransactionCategory.SeniorPoolUnstake,
  TransactionCategory.SeniorPoolUnstakeAndWithdrawal,
  TransactionCategory.SeniorPoolWithdrawal,
];

interface TransactionTableProps {
  isPreview?: boolean;
}

export function TransactionTable({ isPreview = false }: TransactionTableProps) {
  const { account } = useWallet();

  const { data, error, fetchMore, loading } = useCurrentUserTransactionsQuery({
    variables: {
      account: account?.toLowerCase() ?? "",
      first: isPreview ? 5 : 20,
      skip: 0,
    },
  });

  const filteredTxs = reduceOverlappingEventsToNonOverlappingTxs(
    data?.transactions
  );

  const rows = (isPreview ? filteredTxs.slice(0, 5) : filteredTxs).map(
    (transaction) => {
      let sentAmount = null,
        receivedAmount = null;

      if (transaction.sentNftType === SupportedNft.PoolToken) {
        sentAmount = (
          <div className="flex items-center gap-2">
            <Link
              href={`https://opensea.io/assets/ethereum/0x57686612c601cb5213b01aa8e80afeb24bbd01df/${transaction.sentNftId}`}
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              {`Pool Token ID: ${transaction.sentNftId}`}
            </Link>
          </div>
        );
      } else if (transaction.sentNftType === SupportedNft.StakingToken) {
        sentAmount = (
          <div className="flex items-center gap-2">
            <Link
              href={`https://opensea.io/assets/ethereum/0xfd6ff39da508d281c2d255e9bbbfab34b6be60c3/${transaction.sentNftId}`}
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              {`Staked Token ID: ${transaction.sentNftId}`}
            </Link>
          </div>
        );
      } else if (
        transaction.sentToken &&
        transaction.sentAmount &&
        !transaction.sentAmount.isZero()
      ) {
        sentAmount = (
          <FormatWithIcon
            cryptoAmount={{
              token: transaction.sentToken,
              amount: transaction.sentAmount,
            }}
          />
        );
      }

      if (transaction.receivedNftType === SupportedNft.PoolToken) {
        receivedAmount = (
          <div className="flex items-center gap-2">
            <Link
              href={`https://opensea.io/assets/ethereum/0x57686612c601cb5213b01aa8e80afeb24bbd01df/${transaction.receivedNftId}`}
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              {`Pool Token ID: ${transaction.receivedNftId}`}
            </Link>
          </div>
        );
      } else if (transaction.receivedNftType === SupportedNft.StakingToken) {
        receivedAmount = (
          <div className="flex items-center gap-2">
            <Link
              href={`https://opensea.io/assets/ethereum/0xfd6ff39da508d281c2d255e9bbbfab34b6be60c3/${transaction.receivedNftId}`}
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              {`Staked Token ID: ${transaction.receivedNftId}`}
            </Link>
          </div>
        );
      } else if (
        transaction.receivedToken &&
        transaction.receivedAmount &&
        !transaction.receivedAmount.isZero()
      ) {
        receivedAmount = (
          <FormatWithIcon
            cryptoAmount={{
              token: transaction.receivedToken,
              amount: transaction.receivedAmount,
            }}
          />
        );
      }

      const date = new Date(transaction.timestamp * 1000);

      return [
        <div
          key={`${transaction.id}-category`}
          className="flex items-center gap-3 text-left"
        >
          <Icon name={getTransactionIcon(transaction)} size="sm" />
          {getTransactionLabel(transaction)}
        </div>,
        <div key={`${transaction.id}-date`} className="text-left">
          {format(date, "MMM d, y")}
        </div>,
        <div key={`${transaction.id}-sent`} className="text-left">
          {sentAmount || "--"}
        </div>,
        <div key={`${transaction.id}-received`} className="text-left">
          {receivedAmount || "--"}
        </div>,
        <div key={`${transaction.id}-price`} className="text-left">
          {(transaction.fiduPrice &&
            formatCrypto({
              amount: transaction.fiduPrice,
              token: SupportedCrypto.Fidu,
            })) ||
            "--"}
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
          ) : seniorPoolCategories.includes(transaction.category) ? (
            <Link
              href="/pools/senior"
              iconRight="ArrowTopRight"
              className="text-sand-400"
            >
              Senior Pool
            </Link>
          ) : curvePoolCategories.includes(transaction.category) ? (
            <Link
              href="https://curve.fi/factory-crypto/23"
              iconRight="ArrowTopRight"
              className="text-sand-400"
              target={"_blank"}
            >
              Curve Pool
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
    }
  );

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
      headings={["Type", "Date", "Sent", "Received", "Price", "Links", ""]}
      rows={rows}
      onScrollBottom={!isPreview ? onScrollBottom : undefined}
    />
  );
}
