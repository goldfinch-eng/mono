import { BigNumber, FixedNumber, utils } from "ethers";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Form,
  Paragraph,
} from "@/components/design-system";
import { FIDU_DECIMALS, USDC_DECIMALS, USDC_MANTISSA } from "@/constants";
import { getContract2 } from "@/lib/contracts";
import { formatPercent } from "@/lib/format";
import { approveErc20IfRequired } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

interface LpCurveFormProps {
  balance: CryptoAmount<"FIDU" | "USDC">;
  type: "FIDU" | "USDC";
  onComplete: () => Promise<unknown>;
}

interface CurveForm {
  isStaking: boolean;
  amount: string;
}

export function LpCurveForm({ balance, type, onComplete }: LpCurveFormProps) {
  const { account, signer } = useWallet();

  const rhfMethods = useForm<CurveForm>();
  const { control, watch, register, setError, clearErrors } = rhfMethods;

  const onSubmit = async (data: CurveForm) => {
    if (!account || !signer) {
      return;
    }
    const stakingRewardsContract = await getContract2({
      name: "StakingRewards",
      signer,
    });
    const fiduContract = await getContract2({ name: "Fidu", signer });
    const usdcContract = await getContract2({ name: "USDC", signer });

    const value = utils.parseUnits(
      data.amount,
      type === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
    );

    if (type === "FIDU") {
      await approveErc20IfRequired({
        account,
        spender: stakingRewardsContract.address,
        amount: value,
        erc20Contract: fiduContract,
      });
    } else {
      await approveErc20IfRequired({
        account,
        spender: stakingRewardsContract.address,
        amount: value,
        erc20Contract: usdcContract,
      });
    }

    // For these .deposit calls, keep in mind that they take two parameters: fiduAmount and usdcAmount. Since the UI only offers depositing FIDU or USDC, we conditionally make one of these params 0
    if (data.isStaking) {
      await toastTransaction({
        transaction: stakingRewardsContract.depositToCurveAndStake(
          type === "FIDU" ? value : BigNumber.from(0),
          type === "USDC" ? value : BigNumber.from(0)
        ),
        pendingPrompt: "Depositing and staking transaction submitted",
      });
    } else {
      await toastTransaction({
        transaction: stakingRewardsContract.depositToCurve(
          type === "FIDU" ? value : BigNumber.from(0),
          type === "USDC" ? value : BigNumber.from(0)
        ),
        pendingPrompt: "Depositing to curve transaction submitted",
      });
    }

    await onComplete();
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

  const isStaking = watch("isStaking");
  const amount = watch("amount");

  useEffect(() => {
    // ! This calculation doesn't match the price impact shown on https://curve.fi/factory-crypto/23/deposit. Not sure how to replicate their calculation
    // https://linear.app/goldfinch/issue/GFI-982/slippage-aka-price-impact-values-calculated-by-our-client-do-not-match
    const checkSlippage = async (amount: string) => {
      if (!amount) {
        return;
      }
      const curvePoolContract = await getContract2({ name: "CurvePool" });
      const seniorPoolContract = await getContract2({ name: "SeniorPool" });

      const fiduMantissa = BigNumber.from(10).pow(FIDU_DECIMALS);
      const value = utils.parseUnits(
        amount,
        type === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
      );
      if (value.isZero()) {
        return;
      }
      const usdcAmount = type === "USDC" ? value : BigNumber.from(0);
      const fiduAmount = type === "FIDU" ? value : BigNumber.from(0);
      const fiduSharePrice = await seniorPoolContract.sharePrice();
      const virtualPrice = await curvePoolContract.lp_price();
      try {
        const estimatedTokensReceived =
          await curvePoolContract.calc_token_amount([fiduAmount, usdcAmount]);
        const virtualValue = estimatedTokensReceived
          .mul(virtualPrice)
          .div(fiduMantissa);
        const realValue = fiduAmount
          .mul(fiduSharePrice)
          .div(fiduMantissa)
          .add(usdcAmount.mul(fiduMantissa).div(USDC_MANTISSA));
        const slippage = Math.abs(
          FixedNumber.from(virtualValue)
            .divUnsafe(FixedNumber.from(realValue))
            .subUnsafe(FixedNumber.from(1))
            .toUnsafeFloat()
        );
        const displayPercent = formatPercent(slippage / 100);

        if (slippage > 10) {
          setError("amount", {
            message: `Price impact is too high: ${displayPercent}. Reduce the amount you are depositing.`,
          });
        } else if (slippage > 0.5) {
          setError("amount", {
            type: "warn",
            message: `High price impact: ${displayPercent}. Consider reducing the amount you are depositing.`,
          });
        } else {
          clearErrors("amount");
        }
      } catch (e) {
        setError("amount", {
          message:
            "Price impact is too high. Reduce the amount you're depositing.",
        });
      }
    };
    checkSlippage(amount);
  }, [amount, type, setError, clearErrors]);

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

      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div className="max-w-xl flex-1">
          <DollarInput
            control={control}
            name="amount"
            label="Amount"
            hideLabel
            unit={balance.token}
            rules={{ required: "Required", validate: validateMax }}
            textSize="xl"
            maxValue={balance.amount}
          />
        </div>

        <Button type="submit" size="xl" className="px-12 py-5">
          {isStaking ? "Deposit and Stake" : "Deposit"}
        </Button>
      </div>
    </Form>
  );
}
