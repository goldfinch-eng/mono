import { useForm } from "react-hook-form";

import { DollarInput, Form, Button } from "@/components/design-system";
import { stringToCryptoAmount } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";

import { devserverRequest } from "./helpers";

export function WithdrawalMechanics() {
  return (
    <div>
      <div className="mb-2 text-2xl font-bold">Withdrawal Mechanics</div>
      <DrainSeniorPoolForm />
    </div>
  );
}

function DrainSeniorPoolForm() {
  type FormFields = { amount: string };
  const rhfMethods = useForm<FormFields>();
  const onSubmit = async (data: FormFields) => {
    const usdc = stringToCryptoAmount(data.amount, SupportedCrypto.Usdc);
    const response = await devserverRequest("drainSeniorPool", {
      usdcAmount: usdc.amount.toString(),
    });
    if (!response.ok) {
      throw new Error((await response.json()).message);
    }
  };
  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div className="mb-1 text-lg font-medium">Drain senior pool</div>
      <div className="flex gap-2">
        <DollarInput
          unit={SupportedCrypto.Usdc}
          control={rhfMethods.control}
          name="amount"
          label="USDC amount"
          hideLabel
        />
        <Button type="submit">Drain</Button>
      </div>
    </Form>
  );
}
