import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";
import { useState } from "react";

import { Button, InfoIconTooltip, MiniTable } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  CallPanelCallableLoanFieldsFragment,
  CallPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { getLoanRepaymentStatus, LoanRepaymentStatus } from "@/lib/pools";

import { SubmitCallModal } from "./submit-call-modal";

gql`
  fragment CallPanelPoolTokenFields on PoolToken {
    id
    principalAmount
    principalRedeemable @client
    principalRedeemed
    calledAt
    callDueAt
    isCapitalCalled
  }
`;

gql`
  fragment CallPanelCallableLoanFields on CallableLoan {
    id
    address
    balance
    termEndTime
    delinquency @client
    loanPhase @client
    inLockupPeriod @client
    nextPrincipalDueTime @client
  }
`;

interface CallPanel {
  className?: string;
  callableLoan: CallPanelCallableLoanFieldsFragment;
  poolTokens: CallPanelPoolTokenFieldsFragment[];
}

export function CallPanel({ className, callableLoan, poolTokens }: CallPanel) {
  const repaymentStatus = getLoanRepaymentStatus(callableLoan);
  const shouldDisableCalls =
    callableLoan.inLockupPeriod ||
    callableLoan.loanPhase !== "InProgress" ||
    repaymentStatus === LoanRepaymentStatus.Repaid;
  const [isCallRequestModalOpen, setIsCallRequestModalOpen] = useState(false);
  const callablePoolTokens = poolTokens.filter((pt) => !pt.isCapitalCalled);
  const calledPoolTokens = poolTokens.filter((pt) => pt.isCapitalCalled);

  const miniTableRows = Object.entries(
    calledPoolTokens
      .sort((a, b) => a.callDueAt ?? 0 - (b.callDueAt ?? 0))
      .reduce((prev, current) => {
        const key = current.callDueAt;
        if (!key) {
          return prev;
        } else if (!prev[key]) {
          prev[key] = { token: "USDC", amount: current.principalAmount };
        } else {
          prev[key] = {
            token: "USDC",
            amount: current.principalAmount.add(prev[key].amount),
          };
        }
        return prev;
      }, {} as Record<string, CryptoAmount<"USDC">>)
  ).map(([dueTime, calledAmount]) => [
    "USDC",
    formatCrypto(calledAmount),
    formatDate(parseInt(dueTime) * 1000, "MMMM d, yyyy"),
  ]);

  return (
    <div className={className}>
      {calledPoolTokens.length > 0 ? (
        <>
          <div className="mb-3 flex justify-between text-sm">
            <div>Call requests</div>
            <InfoIconTooltip content="Call requests you have made for this deal." />
          </div>
          <MiniTable
            className="mb-5"
            colorScheme="mustard"
            rows={miniTableRows}
          />
        </>
      ) : null}
      <Button
        size="xl"
        colorScheme="transparent-mustard"
        className="block w-full"
        onClick={() => setIsCallRequestModalOpen(true)}
        disabled={shouldDisableCalls}
      >
        {calledPoolTokens.length > 0
          ? "Submit another call request"
          : "Submit call request"}
      </Button>
      {shouldDisableCalls ? (
        <div className="mt-1 text-sm text-sand-500">
          {callableLoan.inLockupPeriod
            ? `You may not call capital during the lockup period. Call requests
              become available after ${formatDate(
                callableLoan.nextPrincipalDueTime * 1000,
                "MMM d, yyyy"
              )}.`
            : callableLoan.loanPhase === "DrawdownPeriod"
            ? "You may not submit a call yet because this loan is still in the drawdown phase."
            : null}
        </div>
      ) : null}

      <SubmitCallModal
        callableLoanAddress={callableLoan.address}
        callablePoolTokens={callablePoolTokens}
        isOpen={isCallRequestModalOpen}
        onClose={() => setIsCallRequestModalOpen(false)}
      />
    </div>
  );
}
