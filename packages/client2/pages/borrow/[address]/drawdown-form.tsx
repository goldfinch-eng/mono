import { useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, DollarInput, Form } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { stringToCryptoAmount } from "@/lib/format";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";
import { CreditLineStatus } from "@/pages/borrow/helpers";

interface DrawdownProps {
  availableForDrawdown: BigNumber;
  tranchedPoolAddress: string;
  creditLineStatus?: CreditLineStatus;
  isAfterTermEndTime: boolean;
  borrowerContractAddress: string;
  onClose: () => void;
}

export function DrawdownForm({
  availableForDrawdown,
  tranchedPoolAddress,
  creditLineStatus,
  isAfterTermEndTime,
  borrowerContractAddress,
  onClose,
}: DrawdownProps) {
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  type FormFields = { usdcAmount: string };
  const rhfMethods = useForm<FormFields>();
  const { control } = rhfMethods;

  const onSubmit = async (data: FormFields) => {
    if (!account || !provider) {
      return;
    }

    const usdc = stringToCryptoAmount(data.usdcAmount, "USDC");
    const borrowerContract = await getContract({
      name: "Borrower",
      address: borrowerContractAddress,
      provider,
    });
    await toastTransaction({
      transaction: borrowerContract.drawdown(
        tranchedPoolAddress,
        usdc.amount,
        account
      ),
      pendingPrompt: "Credit Line drawdown submitted.",
    });
    await apolloClient.refetchQueries({ include: "active" });
    onClose();
  };

  const validateDrawdownAmount = (value: string) => {
    const usdcToWithdraw = stringToCryptoAmount(value, "USDC");
    if (usdcToWithdraw.amount.gt(availableForDrawdown)) {
      return "Amount exceeds available for drawdown";
    }
    if (usdcToWithdraw.amount.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  return (
    <>
      {creditLineStatus === CreditLineStatus.PaymentLate ? (
        <div className="mb-4 text-lg">
          Cannot drawdown when payment is past due
        </div>
      ) : isAfterTermEndTime ? (
        <div className="mb-4 text-lg ">Cannot drawdown after term end time</div>
      ) : null}
      <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
        <div className="flex items-start gap-8">
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
            disabled={
              creditLineStatus === CreditLineStatus.PaymentLate ||
              isAfterTermEndTime
            }
          />
          <Button
            type="submit"
            size="xl"
            as="button"
            colorScheme="mustard"
            className="border border-transparent !px-12 !py-5"
            disabled={
              creditLineStatus === CreditLineStatus.PaymentLate ||
              isAfterTermEndTime
            }
          >
            Submit
          </Button>
        </div>
      </Form>
    </>
  );
}
