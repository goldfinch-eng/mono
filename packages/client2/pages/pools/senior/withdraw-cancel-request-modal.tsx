import { BigNumber, FixedNumber, utils } from "ethers";

import { Modal, Button, Link } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface WithdrawCancelRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  withdrawalToken?: BigNumber | null;
  currentRequest?: BigNumber | null;
  cancellationFee: FixedNumber;
}

export default function WithdrawCancelRequestModal({
  isOpen,
  onClose,
  withdrawalToken,
  currentRequest,
  onComplete,
  cancellationFee,
}: WithdrawCancelRequestModalProps) {
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
      onClose={() => {
        onClose();
      }}
      className=" !bg-sand-100"
      titleSize="lg"
    >
      <div className="mb-7">
        <h5 className="mb-2 text-base font-medium">
          Confirm withdrawal request
        </h5>
        <div className="mb-2 flex flex-wrap rounded border border-sand-200 bg-white">
          <div className="w-1/2 border-r border-b border-sand-200 p-5">
            <div className="mb-3 text-sm">Current request</div>
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
          <div className="w-1/2 border-b border-sand-200 p-5">
            <div className="mb-3 text-sm">New request</div>
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
          <div className="w-1/2 border-r border-sand-200 p-5">
            <div className="mb-3 text-sm">Cancellation fee</div>
            <div className="text-lg text-redclay-500">
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
          <div className="w-1/2 p-5">
            <div className="mb-3 text-sm">Change effective</div>
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
