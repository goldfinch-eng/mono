import { useForm } from "react-hook-form";

import { Button, DollarInput, Form, Input } from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";
import { stringToCryptoAmount } from "@/lib/format";
import { approveErc20IfRequired } from "@/lib/pools";
import { useWallet2 } from "@/lib/wallet";

export function CallableTools() {
  return (
    <div>
      <div className="mb-4 text-xl font-bold">Pay loan</div>
      <PayForm />
    </div>
  );
}

function PayForm() {
  const rhfMethods = useForm<{
    callableLoanAddress: string;
    payAmount: string;
  }>();
  const { account, signer } = useWallet2();
  const onSubmit = async (data: {
    callableLoanAddress: string;
    payAmount: string;
  }) => {
    if (!signer || !account) {
      throw new Error("Wallet not connected properly");
    }
    const usdc = stringToCryptoAmount(data.payAmount, "USDC");
    const [callableLoanContract, usdcContract] = await Promise.all([
      getContract2({
        name: "CallableLoan",
        address: data.callableLoanAddress,
        signer,
      }),
      getContract2({ name: "USDC", signer }),
    ]);
    await approveErc20IfRequired({
      account,
      spender: data.callableLoanAddress,
      amount: usdc.amount,
      erc20Contract: usdcContract,
    });
    await callableLoanContract["pay(uint256)"](usdc.amount);
  };
  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <Input
        {...rhfMethods.register("callableLoanAddress")}
        label="Callable loan address"
      />
      <DollarInput
        control={rhfMethods.control}
        name="payAmount"
        unit="USDC"
        label="Amount to pay"
      />
      <Button type="submit">Pay</Button>
    </Form>
  );
}
