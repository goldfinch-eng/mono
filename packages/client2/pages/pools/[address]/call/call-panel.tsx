import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";
import { useState } from "react";

import { Button, InfoIconTooltip, MiniTable } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  CallPanelCallableLoanFieldsFragment,
  CallPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";

import { SubmitCallModal } from "./submit-call-modal";

gql`
  fragment CallPanelPoolTokenFields on PoolToken {
    id
    principalAmount
    principalRedeemable
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
  const [isCallRequestModalOpen, setIsCallRequestModalOpen] = useState(false);
  const callablePoolTokens = poolTokens.filter((pt) => !pt.isCapitalCalled);
  const calledPoolTokens = poolTokens.filter((pt) => pt.isCapitalCalled);
  return (
    <div className={className}>
      {calledPoolTokens.length === 0 ? (
        <div>
          <Button
            size="xl"
            colorScheme="transparent-mustard"
            className="block w-full"
            onClick={() => setIsCallRequestModalOpen(true)}
            disabled={callableLoan.inLockupPeriod}
          >
            Submit call request
          </Button>
          {callableLoan.inLockupPeriod ? (
            <div className="mt-1">
              You may not call capital during the lockup period. Call requests
              become available after{" "}
              {formatDate(
                callableLoan.nextPrincipalDueTime * 1000,
                "MMM d, yyyy"
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-between text-sm">
            <div>Call requests</div>
            <InfoIconTooltip content="TODO content" />
          </div>
          <MiniTable
            colorScheme="mustard"
            rows={calledPoolTokens.map((poolToken) => [
              "USDC",
              formatCrypto({
                token: "USDC",
                amount: poolToken.principalAmount,
              }),
              formatDate((poolToken.callDueAt ?? 0) * 1000, "MMMM d, yyyy"),
            ])}
          />
          <Button
            size="xl"
            colorScheme="transparent-mustard"
            className="mt-5 block w-full"
            onClick={() => setIsCallRequestModalOpen(true)}
          >
            Increase call request
          </Button>
        </div>
      )}

      <SubmitCallModal
        callableLoanAddress={callableLoan.address}
        callablePoolTokens={callablePoolTokens}
        isOpen={isCallRequestModalOpen}
        onClose={() => setIsCallRequestModalOpen(false)}
      />
    </div>
  );
}
