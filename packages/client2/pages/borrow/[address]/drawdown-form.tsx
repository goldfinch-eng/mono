import { useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Button, DollarInput, Form } from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { stringToCryptoAmount } from "@/lib/format";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface DrawdownProps {
  availableForDrawdown: BigNumber;
  tranchedPoolId: string;
  isLate: boolean;
  isAfterTermEndTime: boolean;
  borrowerContractId: string;
  onClose: () => void;
}

export function DrawdownForm({
  availableForDrawdown,
  tranchedPoolId,
  isLate,
  isAfterTermEndTime,
  borrowerContractId,
  onClose,
}: DrawdownProps) {
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  type FormFields = { usdcAmount: string };
  const rhfMethods = useForm<FormFields>({ shouldFocusError: false });
  const { control } = rhfMethods;

  const onSubmit = async (data: FormFields) => {
    if (!account || !provider) {
      return;
    }

    const usdc = stringToCryptoAmount(data.usdcAmount, "USDC");
    const borrowerContract = await getContract({
      name: "Borrower",
      address: borrowerContractId,
      provider,
    });
    await toastTransaction({
      transaction: borrowerContract.drawdown(
        tranchedPoolId,
        usdc.amount,
        account
      ),
      pendingPrompt: "Credit Line drawdown submitted.",
    });
    await apolloClient.refetchQueries({ include: "active" });
    onClose();
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
    <>
      {isLate ? (
        <div className="mb-4 text-lg ">
          Cannot drawdown when payment is past due
        </div>
      ) : isAfterTermEndTime ? (
        <div className="mb-4 text-lg ">Cannot drawdown after term end time</div>
      ) : null}
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
            disabled={isLate || isAfterTermEndTime}
          />
          <Button
            type="submit"
            size="xl"
            as="button"
            colorScheme="mustard"
            className="px-12"
            disabled={isLate || isAfterTermEndTime}
          >
            Submit
          </Button>
        </div>
      </Form>
    </>
  );
}
