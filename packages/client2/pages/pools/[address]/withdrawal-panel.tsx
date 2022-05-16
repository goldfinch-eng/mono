import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { Icon, Button, DollarInput, Link } from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { useTranchedPoolContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  WithdrawalPanelPoolTokenFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { waitForSubgraphBlock } from "@/lib/utils";

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
}

export function WithdrawalPanel({
  tranchedPoolAddress,
  poolTokens,
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

  const { tranchedPoolContract } = useTranchedPoolContract(tranchedPoolAddress);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ amount: string }>();
  const apolloClient = useApolloClient();

  const handler = handleSubmit(async (data) => {
    if (!tranchedPoolContract) {
      return;
    }
    const usdcToWithdraw = utils.parseUnits(data.amount, USDC_DECIMALS);
    let transaction;
    if (
      usdcToWithdraw.lte(
        poolTokens[0].principalRedeemable.add(poolTokens[0].interestRedeemable)
      )
    ) {
      transaction = await tranchedPoolContract.withdraw(
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
        remainingAmount.sub(amountFromThisToken);
      }
      transaction = await tranchedPoolContract.withdrawMultiple(
        tokenIds,
        amounts
      );
    }
    const toastId = toast(
      <div>
        Withdrawal submitted for pool {tranchedPoolAddress}, view it on{" "}
        <Link href={`https://etherscan.io/tx/${transaction.hash}`}>
          etherscan.io
        </Link>
      </div>,
      { autoClose: false }
    );
    const receipt = await transaction.wait();
    await waitForSubgraphBlock(receipt.blockNumber);
    toast.update(toastId, {
      render: `Withdrawal from pool ${tranchedPoolAddress} succeeded`,
      type: "success",
      autoClose: 5000,
    });
    apolloClient.refetchQueries({ include: "active" });
  });

  const validateWithdrawalAmount = (value: string) => {
    const usdcToWithdraw = utils.parseUnits(value, USDC_DECIMALS);
    if (usdcToWithdraw.gt(totalWithdrawable)) {
      return "Withdrawal amount too high";
    }
    if (usdcToWithdraw.lte(BigNumber.from(0))) {
      return "Must withdraw more than 0";
    }
  };

  return (
    <div className="col rounded-xl bg-sunrise-01 p-5 text-white">
      <div className="mb-3 text-sm">Available to withdraw</div>
      <div className="mb-9 flex items-center gap-3 text-5xl">
        {formatCrypto(
          {
            token: SupportedCrypto.Usdc,
            amount: totalWithdrawable,
          },
          { includeSymbol: true }
        )}
        <Icon name="Usdc" size="sm" />
      </div>
      <form onSubmit={handler}>
        <div className="mb-3">
          <DollarInput
            name="amount"
            label="Amount"
            control={control}
            textSize="xl"
            colorScheme="dark"
            rules={{ required: "Required", validate: validateWithdrawalAmount }}
            labelClassName="!mb-3 text-sm"
            errorMessage={errors?.amount?.message}
          />
        </div>
        <Button
          colorScheme="secondary"
          size="xl"
          className="block w-full"
          isLoading={isSubmitting}
          disabled={Object.keys(errors).length !== 0}
        >
          Withdraw
        </Button>
      </form>
    </div>
  );
}
