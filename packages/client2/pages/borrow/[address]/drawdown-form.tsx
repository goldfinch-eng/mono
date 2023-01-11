import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Button, DollarInput, Form } from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface DrawdownProps {
  availableForDrawdown: BigNumber;
  creditLineId: string;
  onClose: () => void;
}

export function DrawdownForm({
  availableForDrawdown,
  creditLineId,
  onClose,
}: DrawdownProps) {
  const { account, provider } = useWallet();

  type FormFields = { usdcAmount: string };
  const rhfMethods = useForm<FormFields>({ shouldFocusError: false });
  const { control } = rhfMethods;

  const onSubmit = async (data: FormFields) => {
    if (!account || !provider) {
      return;
    }

    const usdc = stringToCryptoAmount(data.usdcAmount, "USDC");
    const borrowerContract = await getContract({
      name: "CreditLine",
      address: creditLineId,
      provider,
    });
    await toastTransaction({
      transaction: borrowerContract.drawdown(usdc.amount),
      pendingPrompt: "Credit Line drawdown submitted.",
    });
  };

  const validateDrawdownAmount = (value: string) => {
    const usdcToWithdraw = utils.parseUnits(value, USDC_DECIMALS);
    if (usdcToWithdraw.gt(availableForDrawdown)) {
      return "Amount exceeds available for drawdown";
    }
    if (usdcToWithdraw.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 rounded-t-xl bg-mustard-200 p-8">
        <div className="text-lg text-sand-900">
          {`Available to borrow: ${formatCrypto({
            amount: availableForDrawdown,
            token: "USDC",
          })}`}
        </div>
        <Button
          colorScheme="secondary"
          iconRight="X"
          as="button"
          size="md"
          className="w-fit justify-self-end"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>

      <div className="p-8">
        <div className="mb-4 text-2xl font-medium">Borrow</div>
        <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
          <div className="flex flex-row gap-8">
            <DollarInput
              control={control}
              name="usdcAmount"
              label="USDC amount"
              hideLabel
              unit="USDC"
              rules={{
                required: "Required",
                validate: validateDrawdownAmount,
              }}
              textSize="xl"
              maxValue={availableForDrawdown}
            />
            <Button
              type="submit"
              size="xl"
              as="button"
              colorScheme="mustard"
              className="px-12"
            >
              Submit
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
