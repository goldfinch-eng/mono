import { gql } from "@apollo/client";
import { utils, BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button } from "@/components/design-system";
import { FIDU_DECIMALS, CURVE_LP_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import {
  CryptoAmount,
  StakedPositionType,
  SupportedCrypto,
  UnstakeFormPositionFieldsFragment,
} from "@/lib/graphql/generated";
import { getOptimalPositionsToUnstake } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

export const UNSTAKE_FORM_POSITION_FIELDS = gql`
  fragment UnstakeFormPositionFields on SeniorPoolStakedPosition {
    id
    amount
    positionType
    endTime @client
  }
`;

interface UnstakeForm {
  max: CryptoAmount;
  positionType: StakedPositionType;
  positions: UnstakeFormPositionFieldsFragment[];
  onComplete: () => Promise<unknown>;
}

interface UnstakeFormFields {
  amount: string;
}

export function UnstakeForm({
  max,
  positionType,
  positions,
  onComplete,
}: UnstakeForm) {
  const { account, provider } = useWallet();

  const rhfMethods = useForm<UnstakeFormFields>();
  const { control } = rhfMethods;

  if (positions.some((p) => p.positionType !== positionType)) {
    throw new Error(
      `Not all positions given to UnstakeForm match type ${positionType}`
    );
  }

  const onSubmit = async (data: UnstakeFormFields) => {
    if (!account || !provider) {
      return;
    }
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
      provider,
    });

    const value = utils.parseUnits(
      data.amount,
      positionType === StakedPositionType.Fidu
        ? FIDU_DECIMALS
        : CURVE_LP_DECIMALS
    );

    const optimalPositions = getOptimalPositionsToUnstake(positions, value);

    for (const { id, amount } of optimalPositions) {
      await toastTransaction({
        transaction: stakingRewardsContract.unstake(id, amount),
        pendingPrompt: `Unstaking position ID:${id} submitted`,
      });

      await onComplete(); // Update the new totals after each unstake
    }
  };

  const validateMax = async (value: string) => {
    const parsedValue = utils.parseUnits(
      value,
      positionType === StakedPositionType.Fidu
        ? FIDU_DECIMALS
        : CURVE_LP_DECIMALS
    );

    if (parsedValue.gt(max.amount)) {
      return "Amount exceeds available balance";
    }
    if (parsedValue.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div className="max-w-xl flex-1">
          <DollarInput
            control={control}
            name="amount"
            label="Unstake amount"
            hideLabel
            unit={
              positionType === StakedPositionType.Fidu
                ? SupportedCrypto.Fidu
                : positionType === StakedPositionType.CurveLp
                ? SupportedCrypto.CurveLp
                : assertUnreachable(positionType)
            }
            rules={{ required: "Required", validate: validateMax }}
            textSize="xl"
            maxValue={max.amount}
          />
        </div>

        <Button type="submit" size="xl" className="px-12 py-5">
          Unstake
        </Button>
      </div>
    </Form>
  );
}
