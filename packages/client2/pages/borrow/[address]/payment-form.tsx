import { format as formatDate } from "date-fns";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Form,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface PaymentFormProps {
  remainingPeriodDueAmount: BigNumber;
  remainingTotalDueAmount: BigNumber;
  nextDueTime: BigNumber;
  creditLineId: string;
  onClose: () => void;
}

enum PaymentOption {
  PayMinimumDue = 0,
  PayFullBalancePlusInterest = 1,
  PayOtherAmount = 2,
}

export function PaymentForm({
  remainingPeriodDueAmount,
  remainingTotalDueAmount,
  nextDueTime,
  creditLineId,
  onClose,
}: PaymentFormProps) {
  const { account, provider } = useWallet();

  type FormFields = { usdcAmount: string; paymentOption: PaymentOption };
  const rhfMethods = useForm<FormFields>({ shouldFocusError: false });
  const { control, register, setValue } = rhfMethods;

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
      pendingPrompt: "Credit Line payment submitted.",
    });
  };

  const validatePaymentAmount = (value: string) => {
    const usdcToWithdraw = utils.parseUnits(value, USDC_DECIMALS);
    if (usdcToWithdraw.gt(remainingPeriodDueAmount)) {
      return "Amount exceeds available for drawdown";
    }
    if (usdcToWithdraw.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  const remainingPeriodDueAmountCrypto = {
    amount: remainingPeriodDueAmount,
    token: "USDC",
  } as const;

  const remainingTotalDueAmountCrypto = {
    amount: remainingTotalDueAmount,
    token: "USDC",
  } as const;

  return (
    <div>
      <div className="grid grid-cols-2 rounded-t-xl bg-sand-700 p-8">
        <div className="text-lg text-white">
          {`Next payment: ${formatCrypto(
            remainingPeriodDueAmountCrypto
          )} due due ${formatDate(nextDueTime.toNumber() * 1000, "MMM d")}`}
        </div>
        <Button
          colorScheme="secondary"
          iconRight="X"
          as="button"
          size="sm"
          className="w-fit justify-self-end"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>

      <div className="p-8">
        <div className="mb-4 text-xl font-medium">Pay</div>
        <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <Checkbox
              id="payMinDue"
              labelClassName="text-lg"
              label={`Pay minimum due: ${formatCrypto(
                remainingPeriodDueAmountCrypto
              )}`}
              value={PaymentOption.PayMinimumDue}
              type="radio"
              {...register("paymentOption")}
              onChange={() => {
                setValue(
                  "usdcAmount",
                  formatCrypto(remainingPeriodDueAmountCrypto, {
                    includeSymbol: false,
                    useMaximumPrecision: true,
                  })
                );
              }}
            />
            <Checkbox
              id="payFullBalancePlusInterest"
              labelClassName="text-lg"
              label={`Pay full balance plus interest: ${formatCrypto(
                remainingTotalDueAmountCrypto
              )}`}
              value={PaymentOption.PayFullBalancePlusInterest}
              type="radio"
              {...register("paymentOption")}
              onChange={() => {
                setValue(
                  "usdcAmount",
                  formatCrypto(remainingTotalDueAmountCrypto, {
                    includeSymbol: false,
                    useMaximumPrecision: true,
                  })
                );
              }}
            />
            <Checkbox
              id="payOtherAmount"
              labelClassName="text-lg"
              label="Pay other amount"
              value={PaymentOption.PayOtherAmount}
              type="radio"
              {...register("paymentOption")}
            />
            <div className="mt-4 flex flex-row gap-8">
              <DollarInput
                control={control}
                name="usdcAmount"
                label="USDC amount"
                hideLabel
                unit="USDC"
                rules={{
                  required: "Required",
                  validate: validatePaymentAmount,
                }}
                textSize="xl"
                maxValue={remainingPeriodDueAmount}
              />
              <Button type="submit" size="xl" as="button" className="px-12">
                Submit
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
