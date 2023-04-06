import { useForm } from "react-hook-form";

import { Button, Form, Input } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export function CommunityRewards() {
  return (
    <div>
      <div className="mb-2 text-2xl font-bold">Community Rewards</div>
      <SendTokenForm />
    </div>
  );
}

function SendTokenForm() {
  type FormFields = {
    tokenId: string;
    to: string;
  };
  const rhfMethods = useForm<FormFields>();
  const { provider, account } = useWallet();
  const handleSubmit = async ({ tokenId, to }: FormFields) => {
    if (!provider || !account) {
      throw new Error("Wallet not connected properly");
    }
    const communityRewardsContract = await getContract({
      name: "CommunityRewards",
      provider,
    });
    await toastTransaction({
      transaction: communityRewardsContract.transferFrom(account, to, tokenId),
    });
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={handleSubmit}>
      <div className="mb-2 text-lg font-semibold">Send your tokens</div>
      <div className="flex items-end gap-4">
        <Input {...rhfMethods.register("tokenId")} label="Token ID" />
        <Input {...rhfMethods.register("to")} label="To" />
        <Button type="submit">Send Token</Button>
      </div>
    </Form>
  );
}
