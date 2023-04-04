import { useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form, InfoIconTooltip } from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { sharesToUsdc } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet2 } from "@/lib/wallet";

interface RewardClaimerProps {
  sharePrice: BigNumber;
  className?: string;
  claimable: CryptoAmount<"FIDU">;
}

export function RewardClaimer({
  sharePrice,
  className,
  claimable,
}: RewardClaimerProps) {
  const { signer } = useWallet2();
  const apolloClient = useApolloClient();

  const rhfMethods = useForm();

  const onSubmit = async () => {
    if (!signer) {
      throw new Error("Wallet not connected properly");
    }
    const membershipContract = await getContract2({
      name: "MembershipOrchestrator",
      signer,
    });
    const transaction = membershipContract.collectRewards();
    await toastTransaction({ transaction });
    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-8 rounded-lg border-2 border-mint-200 bg-mint-50 py-5 px-8",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="text-lg">Member Rewards to claim</div>
        <InfoIconTooltip content="New Member Rewards that have been distributed to you. Claim your Member Rewards to add them to your wallet. Member Rewards are distributed in FIDU." />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <div className="mb-1 text-lg font-medium">
            {formatCrypto(claimable)}
          </div>
          <div className="text-sm text-sand-600">
            {formatCrypto(sharesToUsdc(claimable.amount, sharePrice))}
          </div>
        </div>
        <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
          <Button type="submit" variant="rounded" colorScheme="mint" size="lg">
            Claim
          </Button>
        </Form>
      </div>
    </div>
  );
}
