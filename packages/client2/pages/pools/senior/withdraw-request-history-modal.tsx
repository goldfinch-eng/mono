import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";

import { Modal, ShimmerLines } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  useWithdrawRequestTransactionsQuery,
  TransactionCategory,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query WithdrawRequestTransactions($account: String!) {
    transactions(
      orderBy: timestamp
      orderDirection: desc
      where: {
        user: $account
        category_in: [
          SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST
          SENIOR_POOL_WITHDRAWAL_REQUEST
        ]
      }
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
    }
  }
`;

interface WithdrawHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEpoch?: EpochInfo | null;
}

export default function WithdrawHistoryModal({
  isOpen,
  onClose,
  currentEpoch,
}: WithdrawHistoryModalProps) {
  const { account } = useWallet();

  const { data, error, loading } = useWithdrawRequestTransactionsQuery({
    variables: {
      account: account?.toLowerCase() ?? "",
    },
  });

  const rows: string[][] = [];

  data?.transactions.forEach((transaction) => {
    const label =
      transaction.category === TransactionCategory.SeniorPoolWithdrawalRequest
        ? "Initial request"
        : transaction.category ===
          TransactionCategory.SeniorPoolAddToWithdrawalRequest
        ? "Increase request"
        : "";

    const date = new Date(transaction.timestamp * 1000);

    const change = transaction.sentAmount
      ? `+${formatCrypto({
          amount: transaction.sentAmount,
          token: SupportedCrypto.Fidu,
        })}`
      : "";

    rows.push([label, format(date, "MMM d, y"), change, ""]);
  });

  rows.push([
    "Next Distribution",
    format(currentEpoch.endTime.mul(1000).toNumber(), "MMM d, y"),
    "TBD",
    "TBD",
  ]);

  return (
    <Modal
      size="sm"
      title="Request history"
      isOpen={isOpen}
      onClose={() => {
        onClose();
      }}
      className=" !bg-sand-100"
      titleSize="lg"
    >
      {loading ? (
        <ShimmerLines lines={4} truncateFirstLine={false} />
      ) : error ? (
        <div className="text-clay-500">
          There was an error fetching transactions: {error.message}
        </div>
      ) : !account ? (
        <div className="text-clay-500">Wallet not connected</div>
      ) : rows?.length === 0 ? (
        <div className="rounded bg-sand-50 p-3 text-center text-sm text-sand-400">
          No recent activity
        </div>
      ) : (
        <RequestTable rows={rows} />
      )}
    </Modal>
  );
}

function RequestTable({ rows }: { rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left font-normal text-sand-500">
            Action
          </th>
          <th className="px-3 py-2 text-left font-normal text-sand-500">
            Date
          </th>
          <th className="px-3 py-2 text-right font-normal text-sand-500">
            Change (FIDU)
          </th>
          <th className="px-3 py-2 text-right font-normal text-sand-500">
            Remaining (FIDU)
          </th>
        </tr>
      </thead>
      <tbody className="border border-sand-200 ">
        {rows.map((r, idx) => (
          <RequestTableRow items={r} key={`request-history-row-${idx}`} />
        ))}
      </tbody>
    </table>
  );
}

function RequestTableRow({ items }: { items: string[] }) {
  return (
    <tr className="border-b border-b-sand-200">
      {items.map((item, idx) => (
        <td
          key={`request-history-item-${item}`}
          className={clsx(
            "px-3 py-2",
            idx === 0
              ? "border-r border-r-sand-200 bg-sand-200 bg-opacity-20"
              : "",
            idx < 2 ? "text-left" : "text-right"
          )}
        >
          {item}
        </td>
      ))}
    </tr>
  );
}
