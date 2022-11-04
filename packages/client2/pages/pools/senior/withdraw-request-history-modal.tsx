import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";

import { Modal, ShimmerLines } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  useWithdrawalHistoryQuery,
  SupportedCrypto,
  EpochInfo,
  WithdrawalTransactionCategory,
} from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query WithdrawalHistory($account: String!) {
    withdrawalTransactions(
      where: { user: $account, category_not: CANCEL_WITHDRAWAL_REQUEST }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      epochId
      amount
      category
      timestamp
      blockNumber
      category
    }
    epoches {
      id
      fiduRequested
      fiduLiquidated
      usdcAllocated
      endsAt
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
  const decimals = BigNumber.from("1000000000000000000"); // 1e18

  const { account } = useWallet();

  const { data, error, loading } = useWithdrawalHistoryQuery({
    variables: {
      account: account?.toLowerCase() ?? "",
    },
  });

  // Create rows
  const rows: string[][] = [];

  // Setup temp data
  let tempEpochId: string;
  let tempUserTotal: FixedNumber = FixedNumber.from("0");
  let distributionCount = 0;

  // Loop all transactions and calculate distributions for each new epoch encountered
  data?.withdrawalTransactions.forEach((transaction) => {
    // If encoutering new epoch ID, calculate distribution for previous
    if (tempEpochId !== transaction.epochId.toString()) {
      const epochData = data?.epoches.find((epoch) => epoch.id === tempEpochId);

      if (epochData) {
        // Get liquidation percentage
        const liquidatedPercentage = FixedNumber.from(
          epochData.fiduLiquidated
        ).divUnsafe(FixedNumber.from(epochData.fiduRequested));

        // Calculate user's take
        const amountDistributed = tempUserTotal.mulUnsafe(liquidatedPercentage);

        // Get new total
        tempUserTotal = tempUserTotal.subUnsafe(amountDistributed);

        // Push distrubution row to array
        rows.push([
          `Distribution ${distributionCount}`,
          format(new Date(epochData.endsAt * 1000), "MMM d, y"),
          `-${formatCrypto({
            amount: BigNumber.from(amountDistributed).div(decimals),
            token: SupportedCrypto.Fidu,
          })}`,
          formatCrypto({
            amount: BigNumber.from(tempUserTotal).div(decimals),
            token: SupportedCrypto.Fidu,
          }),
        ]);
      }

      // Increment distribution count
      distributionCount++;

      // Set new epoch ID
      tempEpochId = transaction.epochId.toString();
    }

    // Add to users total
    tempUserTotal = tempUserTotal.addUnsafe(
      FixedNumber.from(transaction.amount) ?? FixedNumber.from("0")
    );

    // Push request row to array
    rows.push([
      transaction.category === WithdrawalTransactionCategory.WithdrawalRequest
        ? "Initial request"
        : transaction.category ===
          WithdrawalTransactionCategory.AddToWithdrawalRequest
        ? "Increase request"
        : "",
      format(new Date(transaction.timestamp * 1000), "MMM d, y"),
      transaction.amount
        ? `+${formatCrypto({
            amount: transaction.amount,
            token: SupportedCrypto.Fidu,
          })}`
        : "",
      formatCrypto({
        amount: BigNumber.from(tempUserTotal).div(decimals),
        token: SupportedCrypto.Fidu,
      }),
    ]);
  });

  if (currentEpoch) {
    rows.push([
      "Next Distribution",
      format(currentEpoch.endTime.mul(1000).toNumber(), "MMM d, y"),
      "TBD",
      "TBD",
    ]);
  }

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
          <RequestTableRow
            items={r}
            row={idx}
            key={`request-history-row-${idx}`}
          />
        ))}
      </tbody>
    </table>
  );
}

function RequestTableRow({ items, row }: { items: string[]; row: number }) {
  return (
    <tr className="border-b border-b-sand-200">
      {items.map((item, idx) => (
        <td
          key={`request-history-item-${row}-${idx}-${item}`}
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
