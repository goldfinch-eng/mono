import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, Button } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export function MembershipEpochButton() {
  const rhfMethods = useForm();
  const { provider, account } = useWallet();
  const onSubmit = async () => {
    if (!provider || !account) {
      throw new Error("Wallet not connected properly");
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
  };
  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <Button size="lg" type="submit">
        Finalize Membership Epoch
      </Button>
    </Form>
  );
}
