import clsx from "clsx";
import { BigNumber } from "ethers";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button, Form, InfoIconTooltip } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { CryptoAmount, SupportedCrypto } from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface RewardClaimerProps {
  sharePrice: BigNumber;
  className?: string;
}

export function RewardClaimer({ sharePrice, className }: RewardClaimerProps) {
  const [claimable, setClaimable] = useState<CryptoAmount>({
    token: SupportedCrypto.Fidu,
    amount: BigNumber.from(0),
  });
  const { account, provider } = useWallet();
  useEffect(() => {
    const asyncEffect = async () => {
      if (provider && account) {
        const membershipContract = await getContract({
          name: "MembershipOrchestrator",
          provider,
        });
        const claimableFiduAmount = await membershipContract.claimableRewards(
          account
        );
        setClaimable({
          token: SupportedCrypto.Fidu,
          amount: claimableFiduAmount,
        });
      }
    };
    asyncEffect();
  }, [provider, account]);

  const rhfMethods = useForm();

  const onSubmit = async () => {
    if (!provider || !account) {
      throw new Error("Wallet not connect properly");
    }
    const membershipContract = await getContract({
      name: "MembershipOrchestrator",
      provider,
    });
    const transaction = membershipContract.collectRewards(account);
    toastTransaction({ transaction });
  };

  if (claimable.amount.isZero()) {
    return null;
  } else {
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
            <Button
              type="submit"
              variant="rounded"
              colorScheme="mint"
              size="lg"
            >
              Claim
            </Button>
          </Form>
        </div>
      </div>
    );
  }
}
