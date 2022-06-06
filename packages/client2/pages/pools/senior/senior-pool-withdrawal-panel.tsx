import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Button, DollarInput, Icon } from "@/components/design-system";
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
}

export function SeniorPoolWithDrawalPanel({
  fiduBalance = { token: SupportedCrypto.Fidu, amount: BigNumber.from(0) },
  seniorPoolSharePrice,
  stakedPositions = [],
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
  const availableToWithdrawUsdc = {
    token: SupportedCrypto.Usdc,
    amount: unstakedBalanceUsdc.amount.add(stakedBalanceUsdc.amount),
  };
  console.log({
    unstaked: unstakedBalanceUsdc.amount.toString(),
    staked: stakedBalanceUsdc.amount.toString(),
  });

  const seniorPoolContract = useContract("SeniorPool");
  const stakingRewardsContract = useContract("StakingRewards");
  const apolloClient = useApolloClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
  } = useForm<{ amount: string }>();

  const handler = handleSubmit(async (data) => {
    if (!seniorPoolContract || !stakingRewardsContract) {
      return;
    }
    const sharePrice = await seniorPoolContract.sharePrice(); // ensures that share price is as up-to-date as possible by fetching it when withdrawal is performed.
    const withdrawAmountUsdc = utils.parseUnits(data.amount, USDC_DECIMALS);
    const withdrawAmountFidu = usdcToShares(withdrawAmountUsdc, sharePrice);
    console.log({
      fiduBalance: fiduBalance.amount.toString(),
      sharePrice: sharePrice.toString(),
      usdcToWithdraw: withdrawAmountUsdc.toString(),
      fiduToWithdraw: withdrawAmountFidu.amount.toString(),
    });
    if (withdrawAmountFidu.amount.lte(fiduBalance.amount)) {
      const transaction = seniorPoolContract.withdrawInFidu(
        withdrawAmountFidu.amount
      );
      await toastTransaction({ transaction });
      await apolloClient.refetchQueries({ include: "active" });
    } else {
      // const unstakedWithdrawalPortion = fiduBalance.amount
      // let stakedWithdrawalPortion = BigNumber.from(0)
    }
  });

  return (
    <div className="col rounded-xl bg-sunrise-01 p-5 text-white">
      <div className="mb-3 text-sm">Available to withdraw</div>
      <div className="mb-9 flex items-center gap-3 text-5xl">
        {formatCrypto(availableToWithdrawUsdc, { includeSymbol: true })}
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
            rules={{ required: "Required" }}
            labelClassName="!mb-3 text-sm"
            errorMessage={errors?.amount?.message}
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
          disabled={Object.keys(errors).length !== 0}
          type="submit"
        >
          Withdraw
        </Button>
      </form>
    </div>
  );
}
