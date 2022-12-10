import { gql } from "@apollo/client";
import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";
import { ReactNode, useEffect, useMemo } from "react";

import {
  Button,
  InfoIconTooltip,
  Modal,
  ShimmerLines,
} from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { useWithdrawalHistory2LazyQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

interface WithdrawalHistoryModal {
  isOpen: boolean;
  onClose: () => void;
}

interface Row {
  action: "cancel" | "increase" | "initial" | "distribution" | "postpone";
  description: ReactNode;
  timestamp: number;
  fiduChange: BigNumber;
  fiduRemaining: BigNumber;
}

export function WithdrawalHistoryModal({
  isOpen,
  onClose,
}: WithdrawalHistoryModal) {
  const { account } = useWallet();
  const [executeQuery, { data, loading, error }] =
    useWithdrawalHistory2LazyQuery();
  useEffect(() => {
    if (isOpen && account) {
      executeQuery({ variables: { user: account.toLowerCase() } });
    }
  }, [isOpen, account, executeQuery]);
  const rows: Row[] = useMemo(() => {
    if (!data) {
      return [];
    }
    const r = data.seniorPoolWithdrawalDisbursements
      .map(
        (disbursement, index) =>
          ({
            action: "distribution",
            description: `Distribution ${index + 1}`,
            timestamp: disbursement.allocatedAt * 1000,
            fiduChange: disbursement.fiduLiquidated.mul("-1"),
            fiduRemaining: BigNumber.from(0),
          } as Row)
      )
      .concat(
        data.transactions.map((transaction) => {
          if (transaction.category === "SENIOR_POOL_WITHDRAWAL_REQUEST") {
            return {
              action: "initial",
              description: "Initial request",
              timestamp: transaction.timestamp * 1000,
              fiduChange: transaction.sentAmount as BigNumber,
              fiduRemaining: transaction.sentAmount as BigNumber,
            } as Row;
          } else if (
            transaction.category === "SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST"
          ) {
            return {
              action: "increase",
              description: "Increase request",
              timestamp: transaction.timestamp * 1000,
              fiduChange: transaction.sentAmount as BigNumber,
              fiduRemaining: BigNumber.from(0),
            } as Row;
          } else {
            return {
              action: "cancel",
              description: "Cancel request",
              timestamp: transaction.timestamp * 1000,
              fiduChange: BigNumber.from(0),
              fiduRemaining: BigNumber.from(0),
            } as Row;
          }
        })
      )
      .concat(
        data.seniorPoolWithdrawalDisbursementPostponements.map(
          (postponement) =>
            ({
              action: "postpone",
              description: (
                <div className="flex items-center gap-2">
                  <div>No distribution</div>
                  <InfoIconTooltip
                    content={`This occurs when the Senior Pool receives no deposits or borrower repayments during a two week period. The next distribution occurs on ${formatDate(
                      postponement.newEndsAt * 1000,
                      "MMM dd, yyyy"
                    )}.`}
                  />
                </div>
              ),
              timestamp: postponement.oldEndsAt * 1000,
              fiduChange: BigNumber.from(0),
              fiduRemaining: BigNumber.from(0),
            } as Row)
        )
      );
    r.sort((a, b) => a.timestamp - b.timestamp);
    return r.reduce((prev, current, index) => {
      if (index === 0 || current.action === "initial") {
        return prev.concat(current);
      }
      const prevRow: Row = prev.slice(-1)[0];
      if (current.action === "postpone") {
        return prev.concat({
          ...current,
          fiduRemaining: prevRow.fiduRemaining,
        });
      } else if (current.action === "cancel") {
        return prev.concat({
          ...current,
          fiduChange: prevRow.fiduRemaining.mul("-1"),
        });
      }
      return prev.concat({
        ...current,
        fiduRemaining: prevRow.fiduRemaining.add(current.fiduChange),
      });
    }, [] as Row[]);
  }, [data]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request history"
      size="sm"
      footer={
        <Button
          onClick={onClose}
          colorScheme="secondary"
          size="xl"
          className="block w-full"
        >
          Close
        </Button>
      }
    >
      {error ? (
        <div className="text-clay-500">Unable to fetch request history</div>
      ) : !data || loading ? (
        <ShimmerLines lines={5} />
      ) : (
        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-sand-500">
              <TableHeading>Action</TableHeading>
              <TableHeading>Date</TableHeading>
              <TableHeading rightAligned>Change (FIDU)</TableHeading>
              <TableHeading rightAligned>Remaining (FIDU)</TableHeading>
            </tr>
          </thead>
          <tbody className="rounded border border-sand-200">
            {rows.map((row, index) => (
              <tr key={index}>
                <TableData>{row.description}</TableData>
                <TableData>
                  {formatDate(row.timestamp, "MMM dd, yyyy")}
                </TableData>
                <TableData rightAligned>
                  {formatCrypto({
                    token: "FIDU",
                    amount: row.fiduChange,
                  })}
                </TableData>
                <TableData rightAligned>
                  {formatCrypto({
                    token: "FIDU",
                    amount: row.fiduRemaining,
                  })}
                </TableData>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

gql`
  query WithdrawalHistory2($user: String!) {
    transactions(
      where: {
        user: $user
        category_in: [
          SENIOR_POOL_WITHDRAWAL_REQUEST
          SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST
          SENIOR_POOL_CANCEL_WITHDRAWAL_REQUEST
        ]
      }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      category
      sentAmount
      sentToken
      receivedAmount
      receivedToken
    }
    seniorPoolWithdrawalDisbursements(
      where: { user: $user }
      orderBy: allocatedAt
      orderDirection: asc
    ) {
      id
      allocatedAt
      fiduLiquidated
    }
    seniorPoolWithdrawalDisbursementPostponements(
      where: { user: $user }
      orderBy: oldEndsAt
      orderDirection: asc
    ) {
      id
      oldEndsAt
      newEndsAt
    }
  }
`;

function TableHeading({
  children,
  rightAligned = false,
}: {
  children: ReactNode;
  rightAligned?: boolean;
}) {
  return (
    <th
      scope="col"
      className={clsx(
        "p-2 font-normal text-sand-500",
        rightAligned ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function TableData({
  children,
  rightAligned = false,
}: {
  children: ReactNode;
  rightAligned?: boolean;
}) {
  return (
    <td
      className={clsx(
        "p-2 text-sand-500 first:border-r first:border-sand-200 first:bg-sand-100 first:text-sand-700 last:font-medium last:text-sand-700",
        rightAligned ? "text-right" : "text-left"
      )}
    >
      {children}
    </td>
  );
}
