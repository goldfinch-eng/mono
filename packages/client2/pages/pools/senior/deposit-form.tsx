import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { USDC_DECIMALS } from "@/constants";
import { useSeniorPoolContract, useUsdcContract } from "@/lib/contracts";
import { wait } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface DepositFormProps {
  // eslint-disable-next-line no-unused-vars
  onCompleteDeposit: (blockNumber: number) => Promise<void>;
}

interface FormFields {
  amount: number;
}

export function DepositForm({ onCompleteDeposit }: DepositFormProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors: formErrors },
  } = useForm<FormFields>();
  const { account } = useWallet();
  const { seniorPoolAddress, seniorPoolContract } = useSeniorPoolContract();
  const { usdcContract } = useUsdcContract();

  // TODO big try/catch around the entire handler, or implement a mechanism for catch-all error handling
  const handleDeposit = handleSubmit(async (data) => {
    if (!account || !seniorPoolContract || !usdcContract) {
      return;
    }

    const depositAmount = utils.parseUnits(
      data.amount.toString(),
      USDC_DECIMALS
    );

    const allowance = await usdcContract.allowance(account, seniorPoolAddress);
    if (depositAmount.gt(allowance)) {
      // Approve a really big amount so the user doesn't have to spend gas approving this again in the future
      const approvalTransaction = await usdcContract.approve(
        seniorPoolAddress,
        BigNumber.from(Number.MAX_SAFE_INTEGER - 1)
      );
      await approvalTransaction.wait();
    }

    const transaction = await seniorPoolContract.deposit(depositAmount);
    const receipt = await transaction.wait();
    const minBlock = receipt.blockNumber;
    let callbackSucceeded = false;
    while (!callbackSucceeded) {
      try {
        await onCompleteDeposit(minBlock);
        callbackSucceeded = true;
      } catch (e) {
        if (
          (e as Error).message.includes("has only indexed up to block number")
        ) {
          await wait(1000);
        } else {
          throw e;
        }
      }
    }
  });

  return (
    <form onSubmit={handleDeposit}>
      <Input
        label="Amount ($)"
        inputMode="decimal"
        {...register("amount", {
          required: "Amount is required",
          valueAsNumber: true,
          validate: (value) => {
            if (isNaN(value)) {
              return "Amount must be a number";
            }
            if (value <= 0) {
              return "Amount must be greater than 0";
            }
          },
        })}
        errorMessage={formErrors.amount?.message}
      />
      <Button type="submit" className="mt-8" isLoading={isSubmitting}>
        Submit
      </Button>
    </form>
  );
}
