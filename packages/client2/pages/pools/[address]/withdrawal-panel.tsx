import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import {
  Icon,
  Button,
  DollarInput,
  InfoIconTooltip,
  Form,
  Link,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { WithdrawalPanelPoolTokenFieldsFragment } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export const WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment WithdrawalPanelPoolTokenFields on TranchedPoolToken {
    id
    principalAmount
    principalRedeemable
    interestRedeemable
  }
`;

interface WithdrawalPanelProps {
  tranchedPoolAddress: string;
  poolTokens: WithdrawalPanelPoolTokenFieldsFragment[];
  vaultedPoolTokens: WithdrawalPanelPoolTokenFieldsFragment[];
}

interface FormFields {
  amount: string;
}

export function WithdrawalPanel({
  tranchedPoolAddress,
  poolTokens,
  vaultedPoolTokens,
}: WithdrawalPanelProps) {
  const totalPrincipalRedeemable = poolTokens.reduce(
    (prev, current) => current.principalRedeemable.add(prev),
    BigNumber.from(0)
  );
  const totalInterestRedeemable = poolTokens.reduce(
    (prev, current) => current.interestRedeemable.add(prev),
    BigNumber.from(0)
  );
  const totalWithdrawable = totalPrincipalRedeemable.add(
    totalInterestRedeemable
  );

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
      address: tranchedPoolAddress,
    });

    const usdcToWithdraw = utils.parseUnits(data.amount, USDC_DECIMALS);
    let transaction;
    if (
      usdcToWithdraw.lte(
        poolTokens[0].principalRedeemable.add(poolTokens[0].interestRedeemable)
      )
    ) {
      transaction = tranchedPoolContract.withdraw(
        BigNumber.from(poolTokens[0].id),
        usdcToWithdraw
      );
    } else {
      let remainingAmount = usdcToWithdraw;
      const tokenIds: BigNumber[] = [];
      const amounts: BigNumber[] = [];
      for (const poolToken of poolTokens) {
        if (remainingAmount.isZero()) {
          break;
        }
        const redeemable = poolToken.principalRedeemable.add(
          poolToken.interestRedeemable
        );
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
      transaction = tranchedPoolContract.withdrawMultiple(tokenIds, amounts);
    }
    await toastTransaction({
      transaction,
      pendingPrompt: `Withdrawal submitted for pool ${tranchedPoolAddress}.`,
      successPrompt: `Withdrawal from pool ${tranchedPoolAddress} succeeded.`,
    });
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "tranchedPoolTokens" });
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
    <div className="rounded-xl bg-sunrise-01 p-5 text-white">
      <div className="mb-3 flex justify-between text-sm">
        Available to withdraw
        <InfoIconTooltip
          content="Your USDC funds that are currently available to be withdrawn from this Pool."
          size="sm"
        />
      </div>
      <div className="mb-9 flex items-center gap-3 text-5xl">
        {formatCrypto({
          token: "USDC",
          amount: totalWithdrawable,
        })}
        <Icon name="Usdc" size="sm" />
      </div>
      <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
        <DollarInput
          name="amount"
          label="Amount"
          control={control}
          textSize="xl"
          colorScheme="dark"
          rules={{ validate: validateWithdrawalAmount }}
          labelClassName="!mb-3 text-sm"
          className="mb-3"
          maxValue={totalWithdrawable}
        />
        <Button
          type="submit"
          colorScheme="secondary"
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
        {vaultedPoolTokens.length > 0 ? (
          <div className="flex-column mt-3 flex items-center justify-between gap-4 rounded bg-mustard-200 p-3 text-xs md:flex-row">
            <div className="text-mustard-900">
              You cannot withdraw capital from your positions while they are in
              the Vault
            </div>
            <Link
              href="/membership"
              iconRight="ArrowSmRight"
              className="whitespace-nowrap font-medium text-mustard-700"
            >
              Go to Vault
            </Link>
          </div>
        ) : null}
      </Form>
    </div>
  );
}
