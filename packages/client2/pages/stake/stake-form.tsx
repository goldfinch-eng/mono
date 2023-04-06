import { utils, BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button } from "@/components/design-system";
import { FIDU_DECIMALS, CURVE_LP_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { StakedPositionType } from "@/lib/graphql/generated";
import { approveErc20IfRequired, positionTypeToValue } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface StakeCardFormProps {
  max: CryptoAmount<"FIDU" | "CURVE_LP">;
  positionType: StakedPositionType;
  onComplete: () => Promise<unknown>;
}

interface StakeFormFields {
  amount: string;
}

export function StakeForm({
  max,
  positionType,
  onComplete,
}: StakeCardFormProps) {
  const { account, signer } = useWallet();

  const rhfMethods = useForm<StakeFormFields>();
  const { control } = rhfMethods;

  const onSubmit = async (data: StakeFormFields) => {
    if (!account || !signer) {
      return;
    }
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
      signer,
    });
    const fiduContract = await getContract({ name: "Fidu", signer });
    const curveLpTokenContract = await getContract({
      name: "CurveLP",
      signer,
    });

    const value = utils.parseUnits(
      data.amount,
      positionType === "Fidu" ? FIDU_DECIMALS : CURVE_LP_DECIMALS
    );

    await approveErc20IfRequired({
      account,
      spender: stakingRewardsContract.address,
      amount: value,
      erc20Contract:
        positionType === "Fidu" ? fiduContract : curveLpTokenContract,
    });
    await toastTransaction({
      transaction: stakingRewardsContract.stake(
        value,
        positionTypeToValue[positionType]
      ),
      pendingPrompt: "Staking transaction submitted",
    });

    await onComplete();
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
            label="Stake amount"
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
        </div>

        <Button type="submit" size="xl" className="px-12 py-5">
          Stake
        </Button>
      </div>
    </Form>
  );
}
