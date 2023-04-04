import { gql } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useForm } from "react-hook-form";

import { Form, DollarInput, Button, Link } from "@/components/design-system";
import { FIDU_DECIMALS, USDC_DECIMALS } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { MigrateFormPositionFieldsFragment } from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  getOptimalPositionsToUnstake,
  sum,
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
  usdcBalance: CryptoAmount<"USDC">;
  positions: MigrateFormPositionFieldsFragment[];
  sharePrice: BigNumber;
  onComplete: () => void;
  showVaultWarning?: boolean;
}

interface StakeMigrateForm {
  fiduAmount: string;
  usdcAmount: string;
}

export function MigrateForm({
  usdcBalance,
  positions,
  sharePrice,
  onComplete,
  showVaultWarning = false,
}: StakeCardMigrateFormProps) {
  const maxFidu = {
    token: "FIDU",
    amount: sum("amount", positions),
  } as const;
  const { account, signer } = useWallet();

  const rhfMethods = useForm<StakeMigrateForm>();
  const { control, setValue, getValues } = rhfMethods;

  const onSubmit = async (data: StakeMigrateForm) => {
    if (!account || !signer) {
      return;
    }
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
      signer,
    });
    const zapperContract = await getContract({ name: "Zapper", signer });
    const usdcContract = await getContract({ name: "USDC", signer });

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
          position.amount,
          usdcEquivalent.amount
        ),
        pendingPrompt: `Migrating position ID: ${position.id} submitted`,
      });
    }
    onComplete();
  };

  const handleMaxFidu = async () => {
    setValue(
      "fiduAmount",
      formatCrypto(maxFidu, {
        includeSymbol: false,
        useMaximumPrecision: true,
      })
    );
    setValue(
      "usdcAmount",
      formatCrypto(sharesToUsdc(maxFidu.amount, sharePrice), {
        includeSymbol: false,
        useMaximumPrecision: true,
      })
    );
  };

  const handleMaxUsdc = async () => {
    setValue(
      "usdcAmount",
      formatCrypto(usdcBalance, {
        includeSymbol: false,
        useMaximumPrecision: true,
      })
    );
    setValue(
      "fiduAmount",
      formatCrypto(usdcToShares(usdcBalance.amount, sharePrice), {
        includeSymbol: false,
        useMaximumPrecision: true,
      })
    );
  };

  const syncOtherAmount = (changedAmount: "FIDU" | "USDC") => {
    const fieldValue = getValues(
      changedAmount === "FIDU" ? "fiduAmount" : "usdcAmount"
    );

    if (!fieldValue) return;

    const value = utils.parseUnits(
      fieldValue,
      changedAmount === "FIDU" ? FIDU_DECIMALS : USDC_DECIMALS
    );

    if (changedAmount === "FIDU") {
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

    return validateMax(parsedValue, maxFidu.amount);
  };

  const validateMaxUsdc = async (value: string) => {
    const parsedValue = utils.parseUnits(value, USDC_DECIMALS);

    return validateMax(parsedValue, usdcBalance.amount);
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div className="flex max-w-xl flex-col items-stretch gap-8">
        <div>
          <DollarInput
            control={control}
            name="fiduAmount"
            label={`FIDU amount (max ${formatCrypto(maxFidu, {
              includeSymbol: false,
              includeToken: false,
            })})`}
            unit="FIDU"
            rules={{ required: "Required", validate: validateMaxFidu }}
            textSize="xl"
            onMaxClick={handleMaxFidu}
            onKeyUp={() => syncOtherAmount("FIDU")}
          />
          {showVaultWarning ? (
            <div className="mt-2 flex items-center justify-between rounded bg-mustard-200 py-2 px-3 text-xs">
              <div>You cannot migrate FIDU while it is in the vault</div>
              <Link href="/membership" iconRight="ArrowSmRight">
                Go to Vault
              </Link>
            </div>
          ) : null}
        </div>
        <DollarInput
          control={control}
          name="usdcAmount"
          label={`USDC amount (max ${formatCrypto(usdcBalance, {
            includeSymbol: false,
            includeToken: false,
          })})`}
          unit="USDC"
          rules={{ required: "Required", validate: validateMaxUsdc }}
          textSize="xl"
          onMaxClick={handleMaxUsdc}
          onKeyUp={() => syncOtherAmount("USDC")}
        />
        <Button type="submit" size="xl">
          Migrate
        </Button>
      </div>
    </Form>
  );
}
