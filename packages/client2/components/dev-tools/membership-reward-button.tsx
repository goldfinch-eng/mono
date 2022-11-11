import { useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, Button } from "@/components/design-system";
import { SERVER_URL } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export function MembershipRewardDistributionButton() {
  const rhfMethods = useForm();
  const { provider, account } = useWallet();
  const apolloClient = useApolloClient();
  const onSubmit = async () => {
    if (!provider || !account) {
      throw new Error("Wallet not connected properly");
    }

    for (let i = 0; i < 6; i++) {
      const advanceTimeResponse = await fetch(
        `${SERVER_URL}/advanceTimeOneDay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!advanceTimeResponse.ok) {
        throw new Error("Could not advance time.");
      }
    }

    const usdcContract = await getContract({ name: "USDC", provider });
    const erc20SplitterContract = await getContract({
      name: "ERC20Splitter",
      provider,
    });
    const usdcToSend = {
      token: SupportedCrypto.Usdc,
      amount: BigNumber.from("10000000000"),
    };

    await toastTransaction({
      transaction: usdcContract.transfer(
        erc20SplitterContract.address,
        usdcToSend.amount
      ),
      pendingPrompt: `Sending ${formatCrypto(usdcToSend)} to ERC20 Splitter.`,
      successPrompt: `Sent ${formatCrypto(usdcToSend)} to ERC20 Splitter.`,
    });
    await toastTransaction({
      transaction: erc20SplitterContract.distribute(),
      pendingPrompt: "Finalizing epoch",
    });
    await apolloClient.refetchQueries({ include: "all" });
  };
  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <Button size="lg" type="submit">
        Distribute to Member Rewards
      </Button>
    </Form>
  );
}
