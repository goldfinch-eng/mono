import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Form,
  Paragraph,
} from "@/components/design-system";
import { FIDU_DECIMALS, USDC_DECIMALS } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { CryptoAmount } from "@/lib/graphql/generated";
import { approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface LpCurveFormProps {
  balance: CryptoAmount;
  type: "FIDU" | "USDC";
  onComplete: () => void;
}

interface CurveForm {
  isStaking: boolean;
  amount: string;
}

export default function LpCurveForm({
  balance,
  type,
  onComplete,
}: LpCurveFormProps) {
  const { account, provider } = useWallet();
  const stakingRewardsContract = useContract("StakingRewards");
  const fiduContract = useContract("Fidu");
  const usdcContract = useContract("USDC");

  const rhfMethods = useForm<CurveForm>();
  const { control, setValue, watch, register } = rhfMethods;

  const onSubmit = async (data: CurveForm) => {
    if (
      !account ||
      !provider ||
      !stakingRewardsContract ||
      !fiduContract ||
      !usdcContract
    ) {
      return;
    }

    const value = utils.parseUnits(
      data.amount,
      type === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
    );

    await approveErc20IfRequired({
      account,
      spender: stakingRewardsContract.address,
      amount: value,
      erc20Contract: fiduContract,
    });

    await approveErc20IfRequired({
      account,
      spender: stakingRewardsContract.address,
      amount: value,
      erc20Contract: usdcContract,
    });

    if (data.isStaking) {
      await toastTransaction({
        transaction: stakingRewardsContract.depositToCurveAndStake(
          type === "FIDU" ? value.toString() : BigNumber.from(0),
          type === "USDC" ? value.toString() : BigNumber.from(0)
        ),
        pendingPrompt: "Depositing and staking transaction submitted",
      });
    } else {
      await toastTransaction({
        transaction: stakingRewardsContract.depositToCurve(
          type === "FIDU" ? value.toString() : BigNumber.from(0),
          type === "USDC" ? value.toString() : BigNumber.from(0)
        ),
        pendingPrompt: "Depositing to curve transaction submitted",
      });
    }

    onComplete();
  };

  const handleMax = async () => {
    setValue("amount", formatCrypto(balance, { includeSymbol: false }));
  };

  const validateMax = async (value: string) => {
    const parsedValue = utils.parseUnits(
      value,
      type === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
    );

    if (parsedValue.gt(balance.amount)) {
      return "Amount exceeds available balance";
    }

    if (parsedValue.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  const watchIsStaking = watch("isStaking");

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <Checkbox
        id={`checkbox-staking-${type}`}
        {...register("isStaking")}
        label="I want to stake my Curve LP tokens to earn GFI rewards"
        inputSize="lg"
        className="mb-3"
        labelClassName="text-lg font-medium"
      />
      <Paragraph className="mb-8 ml-10 max-w-3xl">
        Staking incurs an additional gas fee. Because Goldfinch incentivizes
        long-term participation, you will receive maximum GFI rewards by staking
        for at least 12 months.
      </Paragraph>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        <div className="max-w-xl flex-1">
          <DollarInput
            control={control}
            name="amount"
            label="Amount"
            hideLabel
            mask={`amount ${balance.token}`}
            rules={{ required: "Required", validate: validateMax }}
            textSize="xl"
            onMaxClick={handleMax}
          />
        </div>

        <Button type="submit" size="xl" className="px-12">
          {watchIsStaking ? "Deposit and Stake" : "Deposit"}
        </Button>
      </div>
    </Form>
  );
}
