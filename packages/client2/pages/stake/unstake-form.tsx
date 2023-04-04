import { gql } from "@apollo/client";
import { utils, BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button, Link } from "@/components/design-system";
import { FIDU_DECIMALS, CURVE_LP_DECIMALS } from "@/constants";
import { getContract2 } from "@/lib/contracts";
import {
  StakedPositionType,
  UnstakeFormPositionFieldsFragment,
} from "@/lib/graphql/generated";
import { getOptimalPositionsToUnstake, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";
import { useWallet2 } from "@/lib/wallet";

export const UNSTAKE_FORM_POSITION_FIELDS = gql`
  fragment UnstakeFormPositionFields on SeniorPoolStakedPosition {
    id
    amount
    positionType
    endTime @client
  }
`;

interface UnstakeForm {
  positionType: StakedPositionType;
  positions: UnstakeFormPositionFieldsFragment[];
  onComplete: () => Promise<unknown>;
  showVaultWarning?: boolean;
}

interface UnstakeFormFields {
  amount: string;
}

export function UnstakeForm({
  positionType,
  positions,
  onComplete,
  showVaultWarning = false,
}: UnstakeForm) {
  const max = {
    token: positionType === "CurveLP" ? "CURVE_LP" : "FIDU",
    amount: sum("amount", positions),
  };
  const { account, signer } = useWallet2();

  const rhfMethods = useForm<UnstakeFormFields>();
  const { control } = rhfMethods;

  if (positions.some((p) => p.positionType !== positionType)) {
    throw new Error(
      `Not all positions given to UnstakeForm match type ${positionType}`
    );
  }

  const onSubmit = async (data: UnstakeFormFields) => {
    if (!account || !signer) {
      return;
    }
    const stakingRewardsContract = await getContract2({
      name: "StakingRewards",
      signer,
    });

    const value = utils.parseUnits(
      data.amount,
      positionType === "Fidu" ? FIDU_DECIMALS : CURVE_LP_DECIMALS
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
      positionType === "Fidu" ? FIDU_DECIMALS : CURVE_LP_DECIMALS
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
              positionType === "Fidu"
                ? "FIDU"
                : positionType === "CurveLP"
                ? "CURVE_LP"
                : assertUnreachable(positionType)
            }
            rules={{ required: "Required", validate: validateMax }}
            textSize="xl"
            maxValue={max.amount}
          />
          {showVaultWarning ? (
            <div className="mt-2 flex items-center justify-between rounded bg-mustard-200 py-2 px-3 text-xs">
              <div>You cannot unstake FIDU while it is in the vault</div>
              <Link href="/membership" iconRight="ArrowSmRight">
                Go to Vault
              </Link>
            </div>
          ) : null}
        </div>

        <Button type="submit" size="xl" className="px-12 py-5">
          Unstake
        </Button>
      </div>
    </Form>
  );
}
