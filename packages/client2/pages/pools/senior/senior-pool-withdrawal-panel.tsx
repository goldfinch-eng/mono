import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  confirmDialog,
  DollarInput,
  Icon,
  InfoIconTooltip,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  SeniorPoolWithdrawalPanelPositionFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { sharesToUsdc, usdcToShares } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";

export const SENIOR_POOL_WITHDRAWAL_PANEL_POSITION_FIELDS = gql`
  fragment SeniorPoolWithdrawalPanelPositionFields on SeniorPoolStakedPosition {
    id
    amount
  }
`;

interface SeniorPoolWithdrawalPanelProps {
  fiduBalance?: CryptoAmount;
  stakedPositions?: SeniorPoolWithdrawalPanelPositionFieldsFragment[];
  seniorPoolSharePrice: BigNumber;
  seniorPoolLiquidity: BigNumber;
}

export function SeniorPoolWithDrawalPanel({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
  stakedPositions = [],
  seniorPoolLiquidity,
}: SeniorPoolWithdrawalPanelProps) {
  const unstakedBalanceUsdc = sharesToUsdc(
    fiduBalance.amount,
    seniorPoolSharePrice
  );
  const stakedBalanceUsdc = sharesToUsdc(
    stakedPositions.reduce(
      (previous, current) => previous.add(current.amount),
      BigNumber.from(0)
    ),
    seniorPoolSharePrice
  );
  const unstakedPlusStaked = unstakedBalanceUsdc.amount.add(
    stakedBalanceUsdc.amount
  );
  const maxWithdrawable = unstakedPlusStaked.gt(seniorPoolLiquidity)
    ? seniorPoolLiquidity
    : unstakedPlusStaked;

  const seniorPoolContract = useContract("SeniorPool");
  const stakingRewardsContract = useContract("StakingRewards");
  const apolloClient = useApolloClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful, isDirty },
    reset,
    setValue,
  } = useForm<{ amount: string }>();

  const handler = handleSubmit(async (data) => {
    if (!seniorPoolContract || !stakingRewardsContract) {
      return;
    }
    const sharePrice = await seniorPoolContract.sharePrice(); // ensures that share price is as up-to-date as possible by fetching it when withdrawal is performed.
    const withdrawAmountUsdc = utils.parseUnits(data.amount, USDC_DECIMALS);
    const withdrawAmountFidu = usdcToShares(withdrawAmountUsdc, sharePrice);
    if (withdrawAmountFidu.amount.lte(fiduBalance.amount)) {
      const transaction = seniorPoolContract.withdrawInFidu(
        withdrawAmountFidu.amount
      );
      await toastTransaction({ transaction });
      await apolloClient.refetchQueries({ include: "active" });
    } else {
      // If the user's unstaked FIDU was not sufficient for the amount they want to withdraw, unstake-and-withdraw
      // from however many of their staked positions are necessary and sufficient for the remaining portion of the
      // amount they want to withdraw. To be user-friendly, we exit these positions in reverse order of their vesting
      // end time; positions whose rewards vesting schedule has not completed will be exited before positions whose
      // rewards vesting schedule has completed, which is desirable for the user as that maximizes the rate at which
      // they continue to earn vested (i.e. claimable) rewards. Also, note that among the (unstakeable) positions
      // whose rewards vesting schedule has completed, there is no reason to prefer exiting one position versus
      // another, as all such positions earn rewards at the same rate.
      const unstakedWithdrawalPortion = fiduBalance.amount;
      const details = await Promise.all(
        stakedPositions.map((position) =>
          stakingRewardsContract.positions(position.id)
        )
      );
      const detailedPositions = stakedPositions.map((position, index) => ({
        ...position,
        details: details[index],
      }));
      detailedPositions.sort((a, b) =>
        b.details.rewards.endTime.sub(a.details.rewards.endTime).toNumber()
      );
      let remainingWithdrawalAmount = withdrawAmountFidu.amount.sub(
        unstakedWithdrawalPortion
      );
      let forfeitedGfi = BigNumber.from(0);
      const tokenIds: string[] = [];
      const fiduAmounts: BigNumber[] = [];
      for (const position of detailedPositions) {
        if (remainingWithdrawalAmount.isZero()) {
          break;
        }
        if (position.amount.isZero()) {
          continue;
        }
        const amountFromThisToken = position.details.amount.gt(
          remainingWithdrawalAmount
        )
          ? remainingWithdrawalAmount
          : position.details.amount;
        const forfeitedGfiFromThisToken = position.details.rewards.totalUnvested
          .mul(amountFromThisToken)
          .div(position.details.amount);
        forfeitedGfi = forfeitedGfi.add(forfeitedGfiFromThisToken);
        tokenIds.push(position.id);
        fiduAmounts.push(amountFromThisToken);
        remainingWithdrawalAmount =
          remainingWithdrawalAmount.sub(amountFromThisToken);
      }
      if (!remainingWithdrawalAmount.isZero()) {
        throw new Error("Insufficient balance to withdraw");
      }
      if (!forfeitedGfi.isZero()) {
        const confirmation = await confirmDialog(
          `To withdraw this amount, two transactions will be executed. The first transaction will withdraw your unstaked FIDU position, and the second transaction will withdraw your staked FIDU position. As a result of withdrawing this amount, you will forfeit ${formatCrypto(
            { token: SupportedCrypto.Gfi, amount: forfeitedGfi },
            { includeToken: true }
          )} of your FIDU staking rewards.`
        );
        if (!confirmation) {
          throw new Error("User backed out");
        }
      }
      if (!unstakedWithdrawalPortion.isZero()) {
        const transaction1 = seniorPoolContract.withdrawInFidu(
          unstakedWithdrawalPortion
        );
        // purposefully don't await this one, otherwise the second withdrawal will wait for this one to confirm
        toastTransaction({
          transaction: transaction1,
          pendingPrompt: "Submitted withdrawal of unstaked position.",
          successPrompt: "Successfully withdrew unstaked position.",
        }).then(() => apolloClient.refetchQueries({ include: "active" }));
      }
      const transaction2 =
        stakingRewardsContract.unstakeAndWithdrawMultipleInFidu(
          tokenIds,
          fiduAmounts
        );
      await toastTransaction({
        transaction: transaction2,
        pendingPrompt: "Submitted withdrawal of staked position(s).",
        successPrompt: "Successfully withdrew from staked position(s).",
      });
      await apolloClient.refetchQueries({ include: "active" });
    }
  });

  useEffect(() => {
    if (isSubmitSuccessful) {
      reset();
    }
  }, [isSubmitSuccessful, reset]);

  const handleMax = () => {
    setValue(
      "amount",
      utils.formatUnits(maxWithdrawable, USDC_DECIMALS).toString()
    );
  };

  const validateAmount = async (value: string) => {
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);
    if (valueAsUsdc.lte(BigNumber.from(0))) {
      return "Amount must be greater than 0";
    }
    if (valueAsUsdc.gt(maxWithdrawable)) {
      return "Amount exceeds what is available to withdraw";
    }
  };

  return (
    <div className="col rounded-xl bg-sunrise-01 p-5 text-white">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-1 text-sm">
          <div>Available to withdraw</div>
          <InfoIconTooltip content="Your USDC funds that are currently available to be withdrawn from the Senior Pool. It is possible that when a Liquidity Provider wants to withdraw, the Senior Pool may not have sufficient USDC because it is currently deployed in outstanding Borrower Pools across the protocol. In this event, the amount available to withdraw will reflect what can currently be withdrawn, and you may return to withdraw more of your position when new capital enters the Senior Pool through Borrower repayments or new Liquidity Provider investments." />
        </div>
        <div className="flex items-center gap-3 text-5xl">
          {formatCrypto(
            { token: SupportedCrypto.Usdc, amount: maxWithdrawable },
            { includeSymbol: true }
          )}
          <Icon name="Usdc" size="sm" />
        </div>
      </div>
      <div className="mb-9">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <div>Your senior pool position</div>
          <InfoIconTooltip content="The total value of your investment position in the Senior Pool, including funds available to withdraw and funds currently deployed in outstanding Borrower Pools across the protocol." />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xl">
            {formatCrypto(
              { token: SupportedCrypto.Usdc, amount: unstakedPlusStaked },
              { includeSymbol: true }
            )}
          </div>
          <Icon name="Usdc" size="sm" />
        </div>
      </div>
      <form onSubmit={handler}>
        <div className="mb-3">
          <DollarInput
            name="amount"
            label="Withdrawal amount"
            control={control}
            textSize="xl"
            colorScheme="dark"
            rules={{ required: "Required", validate: validateAmount }}
            labelClassName="!mb-3 text-sm"
            errorMessage={errors?.amount?.message}
            onMaxClick={handleMax}
          />
        </div>
        <div className="mb-3 text-sm">
          Please be aware that Goldfinch charges a withdrawal fee of 0.5%
        </div>
        <Button
          colorScheme="secondary"
          size="xl"
          className="block w-full"
          isLoading={isSubmitting}
          disabled={Object.keys(errors).length !== 0 || !isDirty}
          type="submit"
        >
          Withdraw
        </Button>
      </form>
    </div>
  );
}
