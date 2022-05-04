import { useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { Button, Input, Link } from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { useSeniorPoolContract, useUsdcContract } from "@/lib/contracts";
import { refreshCurrentUserUsdcBalance } from "@/lib/state/actions";
import { waitForSubgraphBlock } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface DepositFormProps {
  /**
   * Callback that runs when the deposit transaction is submitted. Does _not_ mean that the transaction is complete, this just means it was sent to the blockchain
   */
  onTransactionSubmitted: () => void;
}

interface FormFields {
  amount: number;
}

export function DepositForm({ onTransactionSubmitted }: DepositFormProps) {
  const apolloClient = useApolloClient();
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
    onTransactionSubmitted();
    const toastId = toast(
      <div>
        Deposit transaction submitted, view it on{" "}
        <Link href={`https://etherscan.io/tx/${transaction.hash}`}>
          etherscan.io
        </Link>
      </div>,
      { autoClose: false }
    );
    const receipt = await transaction.wait();
    await waitForSubgraphBlock(receipt.blockNumber);
    // PATTERN the "active" refetch strategy is a pretty decent medium between refetching everything and explicitly telling Apollo what to refetch
    // It's recommended to use "active" by default unless you know for sure that it's insufficient (for example, there's a piece of data offscreen that needs to be refetched)
    await apolloClient.refetchQueries({ include: "active" });
    refreshCurrentUserUsdcBalance(usdcContract);
    toast.update(toastId, {
      render: "Senior pool deposit completed",
      type: "success",
      autoClose: 5000,
    });
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
