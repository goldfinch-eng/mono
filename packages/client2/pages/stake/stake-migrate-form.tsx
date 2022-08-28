import { gql } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button } from "@/components/design-system";
import { FIDU_DECIMALS, USDC_DECIMALS } from "@/constants";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  MigrateFormPositionFieldsFragment,
} from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  getOptimalPositionsToUnstake,
} from "@/lib/pools";
import { sharesToUsdc, usdcToShares } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export const MIGRATE_FORM_POSITION_FIELDS = gql`
  fragment MigrateFormPositionFields on SeniorPoolStakedPosition {
    id
    amount
    endTime @client
  }
`;

interface StakeCardMigrateFormProps {
  fiduStaked: CryptoAmount;
  usdcBalance: CryptoAmount;
  positions: MigrateFormPositionFieldsFragment[];
  sharePrice: BigNumber;
  onComplete: () => void;
}

interface StakeMigrateForm {
  fiduAmount: string;
  usdcAmount: string;
}

export default function StakeMigrateForm({
  fiduStaked,
  usdcBalance,
  positions,
  sharePrice,
  onComplete,
}: StakeCardMigrateFormProps) {
  const { account, provider } = useWallet();
  const stakingRewardsContract = useContract("StakingRewards");
  const zapperContract = useContract("Zapper");
  const usdcContract = useContract("USDC");

  const rhfMethods = useForm<StakeMigrateForm>();
  const { control, setValue, getValues } = rhfMethods;

  const onSubmit = async (data: StakeMigrateForm) => {
    if (
      !account ||
      !provider ||
      !stakingRewardsContract ||
      !zapperContract ||
      !usdcContract
    ) {
      return;
    }

    const fiduValue = utils.parseUnits(data.fiduAmount, FIDU_DECIMALS);
    const usdcValue = utils.parseUnits(data.usdcAmount, USDC_DECIMALS);

    const optimalPositions = getOptimalPositionsToUnstake(positions, fiduValue);

    const isAlreadyApproved = await stakingRewardsContract.isApprovedForAll(
      account,
      zapperContract.address
    );

    if (!isAlreadyApproved) {
      const approval = await stakingRewardsContract.setApprovalForAll(
        zapperContract.address,
        true
      );
      await approval.wait();
    }

    await approveErc20IfRequired({
      account,
      spender: zapperContract.address,
      amount: usdcValue,
      erc20Contract: usdcContract,
    });

    for (const position of optimalPositions) {
      const usdcEquivalent = sharesToUsdc(position.amount, sharePrice);

      await toastTransaction({
        transaction: zapperContract.zapStakeToCurve(
          position.id,
          position.amount.toString().split(".")[0],
          usdcEquivalent.amount.toString().split(".")[0]
        ),
        pendingPrompt: `Migrating position ID:${position.id} submitted`,
      });

      onComplete();
    }
  };

  const handleMaxFidu = async () => {
    setValue("fiduAmount", formatCrypto(fiduStaked, { includeSymbol: false }));
    setValue(
      "usdcAmount",
      formatCrypto(sharesToUsdc(fiduStaked.amount, sharePrice), {
        includeSymbol: false,
      })
    );
  };

  const handleMaxUsdc = async () => {
    setValue("usdcAmount", formatCrypto(usdcBalance, { includeSymbol: false }));
    setValue(
      "fiduAmount",
      formatCrypto(usdcToShares(usdcBalance.amount, sharePrice), {
        includeSymbol: false,
      })
    );
  };

  const onChange = async (type: "FIDU" | "USDC") => {
    const fieldValue = getValues(type === "FIDU" ? "fiduAmount" : "usdcAmount");

    if (!fieldValue) return;

    const value = utils.parseUnits(
      fieldValue.replace(",", ""),
      type === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
    );

    if (type === "FIDU") {
      setValue(
        "usdcAmount",
        formatCrypto(sharesToUsdc(value, sharePrice), {
          includeSymbol: false,
        })
      );
    } else {
      setValue(
        "fiduAmount",
        formatCrypto(usdcToShares(value, sharePrice), {
          includeSymbol: false,
        })
      );
    }
  };

  const validateMax = async (balance: BigNumber, max: BigNumber) => {
    if (balance.gt(max)) {
      return "Amount exceeds available balance";
    }

    if (balance.lte(BigNumber.from(0))) {
      return "Must be more than 0";
    }
  };

  const validateMaxFidu = async (value: string) => {
    const parsedValue = utils.parseUnits(value, FIDU_DECIMALS);

    return validateMax(parsedValue, fiduStaked.amount);
  };

  const validateMaxUsdc = async (value: string) => {
    const parsedValue = utils.parseUnits(value, USDC_DECIMALS);

    return validateMax(parsedValue, usdcBalance.amount);
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit} className="relative z-10">
      <div className="mb-8 max-w-xl">
        <DollarInput
          control={control}
          name="fiduAmount"
          label={`FIDU amount`}
          mask={`amount FIDU`}
          rules={{ required: "Required", validate: validateMaxFidu }}
          textSize="xl"
          labelClassName="!text-sm !mb-3"
          onMaxClick={handleMaxFidu}
          onKeyUp={() => {
            onChange("FIDU");
          }}
        />
      </div>

      <div className="flex items-start gap-2">
        <div className="max-w-xl flex-1">
          <DollarInput
            control={control}
            name="usdcAmount"
            label={`USDC amount`}
            mask={`amount USDC`}
            rules={{ required: "Required", validate: validateMaxUsdc }}
            textSize="xl"
            labelClassName="!text-sm !mb-3"
            onMaxClick={handleMaxUsdc}
            onKeyUp={() => {
              onChange("USDC");
            }}
          />
        </div>

        <Button type="submit" size="xl" className="mt-8 h-[66px] px-12">
          Migrate
        </Button>
      </div>
    </Form>
  );
}
