import { gql, useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { BigNumber, FixedNumber } from "ethers";
import { Children, ReactNode } from "react";
import { useForm } from "react-hook-form";

import {
  Form,
  Modal,
  Button,
  InfoIconTooltip,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import { WithdrawalCancelModalWithdrawalFieldsFragment } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export const WITHDRAWAL_CANCEL_MODAL_WITHDRAWAL_FIELDS = gql`
  fragment WithdrawalCancelModalWithdrawalFields on SeniorPoolWithdrawalRequest {
    id
    tokenId
    previewFiduRequested @client
  }
`;

type WithdrawalCancelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  existingWithdrawalRequest: WithdrawalCancelModalWithdrawalFieldsFragment;
  cancellationFee: FixedNumber;
};

export function WithdrawalCancelModal({
  isOpen,
  onClose,
  existingWithdrawalRequest,
  cancellationFee,
}: WithdrawalCancelModalProps) {
  const computedFee = BigNumber.from(
    FixedNumber.from(existingWithdrawalRequest.previewFiduRequested)
      .mulUnsafe(cancellationFee)
      .toString()
      .split(".")[0]
  );

  const { provider } = useWallet();
  const apolloClient = useApolloClient();
  const onSubmit = async () => {
    if (!provider) {
      throw new Error("Wallet connection error");
    }
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });
    await toastTransaction({
      transaction: seniorPoolContract.cancelWithdrawalRequest(
        existingWithdrawalRequest.tokenId
      ),
      pendingPrompt: "Cancelling your withdrawal request.",
      successPrompt: "Withdrawal request canceled.",
    });

    // Close the modal _before_ refetching. Unintuitive, but it's because the refetch may discover that the existingWithdrawalRequest gets deleted.
    // This modal depends on the existingWithdrawalRequest, if it gets removed suddenly, this modal just closes with no animation.
    onClose();
    // At least wait enough time to animate the modal closing lol
    await new Promise((resolve) => setTimeout(resolve, 150));

    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "seniorPoolWithdrawalRequests" });
      },
    });
  };

  return (
    <Modal
      title="Cancel withdrawal request"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <Form rhfMethods={useForm()} onSubmit={onSubmit}>
          <Button size="xl" type="submit" className="block w-full">
            Cancel request
          </Button>
        </Form>
      }
    >
      <div className="mb-2 font-medium">Confirm changes</div>
      <Summary className="mb-6">
        <SummaryRow
          left="Current request amount"
          tooltip="FIDU you previously submitted a withdrawal request for."
          right={formatCrypto({
            token: "FIDU",
            amount: existingWithdrawalRequest.previewFiduRequested,
          })}
          faded
        />
        <SummaryRow
          left="New request total"
          tooltip="Your total FIDU withdrawal request outstanding, with the cancellation decrease reflected."
          right="0.00 FIDU"
        />
        <SummaryRow
          left="Cancellation fee"
          tooltip={`Cancelling a request before it is fulfilled incurs a fee of ${formatPercent(
            cancellationFee
          )} of the total request.`}
          right={formatCrypto({
            token: "FIDU",
            amount: computedFee,
          })}
          negative
        />
        <SummaryRow
          left="Change effective"
          tooltip="When your new request total will go into effect."
          right="Immediately"
        />
      </Summary>
    </Modal>
  );
}

function Summary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "divide-y divide-sand-200 rounded-lg border border-sand-200 bg-white",
        className
      )}
    >
      {Children.map(children, (child) => (
        <div className="py-4 px-5">{child}</div>
      ))}
    </div>
  );
}

function SummaryRow({
  left,
  tooltip,
  right,
  negative = false,
  faded = false,
}: {
  left: string;
  tooltip?: string;
  right: string;
  negative?: boolean;
  faded?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <div className="flex items-center gap-2 text-sm">
        {left}
        {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
      </div>
      <div
        className={clsx(
          "text-lg",
          faded ? "text-sand-400" : negative ? "text-clay-500" : "text-sand-700"
        )}
      >
        {right}
      </div>
    </div>
  );
}
