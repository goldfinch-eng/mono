import { utils, BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button } from "@/components/design-system";
import { FIDU_DECIMALS, CURVE_LP_DECIMALS } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { CryptoAmount, StakedPositionType } from "@/lib/graphql/generated";
import { approveErc20IfRequired, positionTypeToValue } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface StakeCardFormProps {
  max: CryptoAmount;
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
  const { account, provider } = useWallet();
  const stakingRewardsContract = useContract("StakingRewards");
  const fiduContract = useContract("Fidu");
  const curveLpTokenContract = useContract("CurveLP");

  const rhfMethods = useForm<StakeFormFields>();
  const { control, setValue } = rhfMethods;

  const onSubmit = async (data: StakeFormFields) => {
    if (
      !account ||
      !provider ||
      !stakingRewardsContract ||
      !fiduContract ||
      !curveLpTokenContract
    ) {
      return;
    }

    const value = utils.parseUnits(
      data.amount,
      positionType === StakedPositionType.Fidu
        ? FIDU_DECIMALS
        : CURVE_LP_DECIMALS
    );

    await approveErc20IfRequired({
      account,
      spender: stakingRewardsContract.address,
      amount: value,
      erc20Contract:
        positionType === StakedPositionType.Fidu
          ? fiduContract
          : curveLpTokenContract,
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

  const handleMax = async () => {
    setValue("amount", formatCrypto(max, { includeSymbol: false }));
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
            label="Stake amount"
            hideLabel
            mask={`amount ${
              positionType === StakedPositionType.Fidu ? "FIDU" : "FIDU-USDC-F"
            }`}
            rules={{ required: "Required", validate: validateMax }}
            textSize="xl"
            onMaxClick={handleMax}
          />
        </div>

        <Button type="submit" size="xl" className="px-12 py-5">
          Stake
        </Button>
      </div>
    </Form>
  );
}
