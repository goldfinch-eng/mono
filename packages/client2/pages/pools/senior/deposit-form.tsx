import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Link } from "@/components/link";
import { USDC_DECIMALS } from "@/constants";
import { useSeniorPoolContract, useUsdcContract } from "@/lib/contracts";
import { refreshCurrentUserUsdcBalance } from "@/lib/graphql/local-state/actions";
import { wait } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface DepositFormProps {
  onCompleteDeposit: () => void;
}

interface FormFields {
  amount: number;
}

const MIN_BLOCK_CHECK = gql`
  query MinBlockCheck($minBlock: Int!) {
    _meta(block: { number_gte: $minBlock }) {
      deployment
    }
  }
`;

export function DepositForm({ onCompleteDeposit }: DepositFormProps) {
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
    const minBlock = receipt.blockNumber;
    let subgraphUpdated = false;
    while (!subgraphUpdated) {
      try {
        // TODO move this min block check into a shared lib. Probably gonna want this in other areas of the app
        await apolloClient.query({
          query: MIN_BLOCK_CHECK,
          variables: { minBlock },
        });
        subgraphUpdated = true;
        await apolloClient.refetchQueries({
          updateCache(cache) {
            cache.modify({
              fields: {
                user(_, { INVALIDATE }) {
                  return INVALIDATE;
                },
                seniorPools(_, { INVALIDATE }) {
                  return INVALIDATE;
                },
              },
            });
          },
        });
        refreshCurrentUserUsdcBalance(usdcContract);
        toast.update(toastId, {
          render: "Senior pool deposit completed",
          type: "success",
          autoClose: 5000,
        });
        onCompleteDeposit();
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
