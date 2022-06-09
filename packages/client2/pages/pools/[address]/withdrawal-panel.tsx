import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Icon, Button, DollarInput, Select } from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  WithdrawalPanelPoolTokenFieldsFragment,
  WithdrawalPanelZapFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";

export const WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment WithdrawalPanelPoolTokenFields on TranchedPoolToken {
    id
    principalAmount
    principalRedeemable
    interestRedeemable
  }
`;

export const WITHDRAWAL_PANEL_ZAP_FIELDS = gql`
  fragment WithdrawalPanelZapFields on Zap {
    id
    amount
    seniorPoolStakedPosition {
      id
    }
    poolToken {
      id
    }
  }
`;

interface WithdrawalPanelProps {
  tranchedPoolAddress: string;
  poolTokens: WithdrawalPanelPoolTokenFieldsFragment[];
  zaps: WithdrawalPanelZapFieldsFragment[];
}

export function WithdrawalPanel({
  tranchedPoolAddress,
  poolTokens,
  zaps,
}: WithdrawalPanelProps) {
  const totalPrincipalRedeemable = poolTokens.reduce(
    (prev, current) => current.principalRedeemable.add(prev),
    BigNumber.from(0)
  );
  const totalInterestRedeemable = poolTokens.reduce(
    (prev, current) => current.interestRedeemable.add(prev),
    BigNumber.from(0)
  );
  const totalZapped = zaps.reduce(
    (prev, current) => current.amount.add(prev),
    BigNumber.from(0)
  );
  const totalWithdrawable = totalPrincipalRedeemable
    .add(totalInterestRedeemable)
    .add(totalZapped);

  const tranchedPoolContract = useContract("TranchedPool", tranchedPoolAddress);
  const zapperContract = useContract("Zapper");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
    watch,
  } = useForm<{ amount: string; destination: string }>({
    defaultValues: { destination: "wallet" },
  });
  const selectedDestination = watch("destination");
  const apolloClient = useApolloClient();

  const handler = handleSubmit(async (data) => {
    if (data.destination === "wallet") {
      if (!tranchedPoolContract) {
        throw new Error("Wallet not connected properly");
      }
      const usdcToWithdraw = utils.parseUnits(data.amount, USDC_DECIMALS);
      let transaction;
      if (
        usdcToWithdraw.lte(
          poolTokens[0].principalRedeemable.add(
            poolTokens[0].interestRedeemable
          )
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
    } else {
      if (!zapperContract) {
        throw new Error("Wallet not connected properly");
      }
      const poolTokenId = BigNumber.from(data.destination.split("-")[1]);
      const transaction = zapperContract.unzapToStakingRewards(poolTokenId);
      await toastTransaction({
        transaction,
        pendingPrompt:
          "Submitted transaction to move capital back to senior pool stake",
        successPrompt:
          "Successfully returned capital back to senior pool stake",
      });
    }
    await apolloClient.refetchQueries({ include: "active" });
  });

  useEffect(() => {
    if (isSubmitSuccessful) {
      reset();
    }
  }, [isSubmitSuccessful, reset]);

  const validateWithdrawalAmount = (value: string) => {
    if (selectedDestination !== "wallet") {
      return;
    }
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

  const availableDestinations = useMemo(() => {
    const wallet = [
      {
        label: `Wallet \u00b7 ${formatCrypto(
          {
            token: SupportedCrypto.Usdc,
            amount: totalPrincipalRedeemable.add(totalInterestRedeemable),
          },
          { includeSymbol: true }
        )}`,
        value: "wallet",
      },
    ];
    const seniorPoolStakedPositions = zaps.map((zap, index) => ({
      label: `Senior Pool Capital ${index + 1} \u00b7 ${formatCrypto(
        { token: SupportedCrypto.Usdc, amount: zap.amount },
        { includeSymbol: true }
      )}`,
      value: `seniorPool-${zap.poolToken.id}`,
    }));
    return wallet.concat(seniorPoolStakedPositions);
  }, [zaps, totalPrincipalRedeemable, totalInterestRedeemable]);

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
        <Select
          control={control}
          options={availableDestinations}
          name="destination"
          label="Destination"
          textSize="xl"
          colorScheme="dark"
          labelClassName="!mb-3 text-sm"
          className={availableDestinations.length > 1 ? "mb-3" : "hidden"}
        />
        <DollarInput
          name="amount"
          label="Amount"
          control={control}
          textSize="xl"
          colorScheme="dark"
          rules={{ validate: validateWithdrawalAmount }}
          labelClassName="!mb-3 text-sm"
          errorMessage={errors?.amount?.message}
          className="mb-3"
          disabled={selectedDestination !== "wallet"}
        />
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
