import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import {
  Button,
  DollarInput,
  InfoIconTooltip,
  Form,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import {
  WithdrawalPanelLoanFieldsFragment,
  WithdrawalPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export const WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment WithdrawalPanelPoolTokenFields on PoolToken {
    id
    principalAmount
  }
`;

gql`
  fragment WithdrawalPanelLoanFields on Loan {
    id
    __typename
    address
  }
`;

interface WithdrawalPanelProps {
  loan: WithdrawalPanelLoanFieldsFragment;
  poolTokens: WithdrawalPanelPoolTokenFieldsFragment[];
}

interface FormFields {
  amount: string;
}

export function WithdrawalPanel({ loan, poolTokens }: WithdrawalPanelProps) {
  const totalWithdrawable = sum("principalAmount", poolTokens);

  const rhfMethods = useForm<FormFields>();
  const { control } = rhfMethods;
  const apolloClient = useApolloClient();
  const { provider } = useWallet();

  const onSubmit = async (data: FormFields) => {
    if (!provider) {
      throw new Error("Wallet not connected properly");
    }
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      address: loan.address,
    });
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      address: loan.address,
    });

    const usdcToWithdraw = utils.parseUnits(data.amount, USDC_DECIMALS);
    let transaction;
    if (usdcToWithdraw.lte(poolTokens[0].principalAmount)) {
      transaction =
        loan.__typename === "TranchedPool"
          ? tranchedPoolContract.withdraw(poolTokens[0].id, usdcToWithdraw)
          : callableLoanContract.withdraw(poolTokens[0].id, usdcToWithdraw);
    } else {
      let remainingAmount = usdcToWithdraw;
      const tokenIds: BigNumber[] = [];
      const amounts: BigNumber[] = [];
      for (const poolToken of poolTokens) {
        if (remainingAmount.isZero()) {
          break;
        }
        const redeemable = poolToken.principalAmount;
        if (redeemable.isZero()) {
          continue;
        }
        const amountFromThisToken = redeemable.gt(remainingAmount)
          ? remainingAmount
          : redeemable;
        tokenIds.push(BigNumber.from(poolToken.id));
        amounts.push(amountFromThisToken);
        remainingAmount = remainingAmount.sub(amountFromThisToken);
      }
      transaction =
        loan.__typename === "TranchedPool"
          ? tranchedPoolContract.withdrawMultiple(tokenIds, amounts)
          : callableLoanContract.withdrawMultiple(tokenIds, amounts);
    }
    await toastTransaction({
      transaction,
      pendingPrompt: `Withdrawal submitted for pool ${loan.id}.`,
      successPrompt: `Withdrawal from pool ${loan.id} succeeded.`,
    });
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "poolTokens" });
      },
    });
  };

  const validateWithdrawalAmount = (value: string) => {
    if (!value) {
      return "You must specify an amount to withdraw";
    }
    const usdcToWithdraw = utils.parseUnits(value, USDC_DECIMALS);
    if (usdcToWithdraw.gt(totalWithdrawable)) {
      return "Withdrawal amount too high";
    }
    if (usdcToWithdraw.lte(BigNumber.from(0))) {
      return "Must withdraw more than 0";
    }
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <DollarInput
        name="amount"
        label="Withdrawal amount"
        control={control}
        textSize="xl"
        colorScheme="light"
        rules={{ validate: validateWithdrawalAmount }}
        labelClassName="!mb-3 text-sm"
        className="mb-3"
        maxValue={totalWithdrawable}
      />
      <Button
        type="submit"
        colorScheme="mustard"
        size="xl"
        className="block w-full"
      >
        Withdraw
      </Button>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-sand-700">
        <InfoIconTooltip
          size="sm"
          content="While this Pool is still open for Backer investments, you can instantly withdraw any amount of the funds you have already invested. Once the Pool has reached its limit for funding and is closed for further investment, you will only be able to withdraw your share of the Pool's interest and principal repayments."
        />
        You can withdraw capital until the pool is closed.
      </div>
    </Form>
  );
}
