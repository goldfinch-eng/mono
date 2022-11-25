import { BigNumber, FixedNumber } from "ethers";

import {
  Modal,
  Button,
  Link,
  InfoIconTooltip,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface WithdrawalCancelRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  withdrawalToken?: BigNumber | null;
  currentRequest?: BigNumber | null;
  cancellationFee: FixedNumber;
}

export default function WithdrawalCancelRequestModal({
  isOpen,
  onClose,
  withdrawalToken,
  currentRequest,
  onComplete,
  cancellationFee,
}: WithdrawalCancelRequestModalProps) {
  const { provider } = useWallet();

  const fees =
    currentRequest && currentRequest.gt(BigNumber.from("0"))
      ? BigNumber.from(
          FixedNumber.from(currentRequest)
            .mulUnsafe(cancellationFee)
            .divUnsafe(FixedNumber.from("1000000000000000000")) // 1e18
        )
      : BigNumber.from("0");

  const cancelRequest = async () => {
    if (withdrawalToken && provider) {
      const seniorPoolContract = await getContract({
        name: "SeniorPool",
        provider,
      });

      const transaction =
        seniorPoolContract.cancelWithdrawalRequest(withdrawalToken);

      await toastTransaction({ transaction });

      onComplete();
    }
  };

  return (
    <Modal
      size="sm"
      title="Cancel withdrawal request"
      isOpen={isOpen}
      onClose={onClose}
      className=" !bg-sand-100"
    >
      <div className="mb-7">
        <h5 className="mb-2 text-base font-medium">Confirm changes</h5>
        <div className="mb-2 rounded border border-sand-200 bg-white">
          <div className="flex items-center justify-between border-b border-sand-200 p-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-sand-600">
                Current request amount
              </div>
              <InfoIconTooltip
                size="sm"
                content="FIDU you previously submitted a withdrawal request for."
              />
            </div>
            <div className="text-lg">
              {formatCrypto(
                {
                  token: SupportedCrypto.Fidu,
                  amount: currentRequest ?? BigNumber.from("0"),
                },
                { includeToken: true }
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-sand-200 p-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-sand-600">New request total</div>
              <InfoIconTooltip
                size="sm"
                content="Your total FIDU withdrawal request outstanding, with the cancellation decrease reflected."
              />
            </div>
            <div className="text-lg">
              {formatCrypto(
                {
                  token: SupportedCrypto.Fidu,
                  amount: BigNumber.from("0"),
                },
                { includeToken: true }
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-sand-200 p-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-sand-600">Cancellation fee</div>
              <InfoIconTooltip
                size="sm"
                content={`Cancelling a request before it is fulfilled incurs a fee of ${formatPercent(
                  cancellationFee
                )} of the total request.`}
              />
            </div>

            <div className="text-lg text-clay-500">
              {currentRequest
                ? formatCrypto(
                    {
                      token: SupportedCrypto.Fidu,
                      amount: fees,
                    },
                    { includeToken: true }
                  )
                : null}
            </div>
          </div>
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <div className="text-sm text-sand-600">Change effective</div>
              <InfoIconTooltip
                size="sm"
                content="When your new request total will go into effect."
              />
            </div>
            <div className="text-lg">Immediatedly</div>
          </div>
        </div>

        <p className="mb-1 text-xs">
          By clicking &ldquo;Cancel request&rdquo; below, I hereby agree to the{" "}
          <Link href="/senior-pool-agreement-interstitial">
            Senior Pool Agreement
          </Link>
          , which includes a {formatPercent(cancellationFee)} cancellation fee,
          deducted from your existing FIDU.
        </p>
      </div>

      <Button size="xl" className="w-full px-12 py-5" onClick={cancelRequest}>
        Cancel request
      </Button>
    </Modal>
  );
}
