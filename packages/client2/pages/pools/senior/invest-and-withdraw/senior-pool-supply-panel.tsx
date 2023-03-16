import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Form,
  InfoIconTooltip,
  Link,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { dataLayerPushEvent } from "@/lib/analytics";
import { generateErc20PermitSignature, getContract } from "@/lib/contracts";
import { formatCrypto, formatPercent } from "@/lib/format";
import { SeniorPoolSupplyPanelPoolFieldsFragment } from "@/lib/graphql/generated";
import { approveErc20IfRequired, computeApyFromGfiInFiat } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { isSmartContract, useWallet } from "@/lib/wallet";

export const SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS = gql`
  fragment SeniorPoolSupplyPanelPoolFields on SeniorPool {
    estimatedApyFromGfiRaw
  }
`;

interface SeniorPoolSupplyPanelProps {
  seniorPool: SeniorPoolSupplyPanelPoolFieldsFragment;
  fiatPerGfi: number;
}

interface FormFields {
  supply: string;
  isStaking: boolean;
}

export function SeniorPoolSupplyPanel({
  seniorPool,
  fiatPerGfi,
}: SeniorPoolSupplyPanelProps) {
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPool.estimatedApyFromGfiRaw,
    fiatPerGfi
  );

  const rhfMethods = useForm<FormFields>({
    defaultValues: { isStaking: true },
  });
  const { control, register } = rhfMethods;
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const onSubmit = async (data: FormFields) => {
    if (!account || !provider) {
      return;
    }

    const usdcContract = await getContract({ name: "USDC", provider });

    const value = utils.parseUnits(data.supply, USDC_DECIMALS);
    let submittedTransaction;

    // Smart contract wallets cannot sign a message and therefore can't use depositWithPermit
    if (await isSmartContract(account, provider)) {
      if (data.isStaking) {
        const stakingRewardsContract = await getContract({
          name: "StakingRewards",
          provider,
        });
        await approveErc20IfRequired({
          account,
          spender: stakingRewardsContract.address,
          amount: value,
          erc20Contract: usdcContract,
        });
        submittedTransaction = await toastTransaction({
          transaction: stakingRewardsContract.depositAndStake(value),
          pendingPrompt: "Deposit and stake to senior pool submitted.",
        });
      } else {
        const seniorPoolContract = await getContract({
          name: "SeniorPool",
          provider,
        });
        await approveErc20IfRequired({
          account,
          spender: seniorPoolContract.address,
          amount: value,
          erc20Contract: usdcContract,
        });
        submittedTransaction = await toastTransaction({
          transaction: seniorPoolContract.deposit(value),
          pendingPrompt: "Deposit into senior pool submitted",
        });
      }
    } else {
      const now = (await provider.getBlock("latest")).timestamp;
      const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now

      if (data.isStaking) {
        const stakingRewardsContract = await getContract({
          name: "StakingRewards",
          provider,
        });
        const signature = await generateErc20PermitSignature({
          erc20TokenContract: usdcContract,
          provider,
          owner: account,
          spender: stakingRewardsContract.address,
          value,
          deadline,
        });
        const transaction = stakingRewardsContract.depositWithPermitAndStake(
          value,
          deadline,
          signature.v,
          signature.r,
          signature.s
        );
        submittedTransaction = await toastTransaction({
          transaction,
          pendingPrompt: `Deposit and stake submitted for senior pool.`,
        });
      } else {
        const seniorPoolContract = await getContract({
          name: "SeniorPool",
          provider,
        });
        const signature = await generateErc20PermitSignature({
          erc20TokenContract: usdcContract,
          provider,
          owner: account,
          spender: seniorPoolContract.address,
          value,
          deadline,
        });
        const transaction = seniorPoolContract.depositWithPermit(
          value,
          deadline,
          signature.v,
          signature.r,
          signature.s
        );
        submittedTransaction = await toastTransaction({
          transaction,
          pendingPrompt: `Deposit submitted for senior pool.`,
        });
      }
    }

    dataLayerPushEvent("DEPOSITED_IN_SENIOR_POOL", {
      transactionHash: submittedTransaction.transactionHash,
      usdAmount: parseFloat(data.supply),
    });

    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "seniorPoolStakedPositions" });
      },
    });
  };

  const validateMaximumAmount = async (value: string) => {
    if (!account || !provider) {
      return;
    }
    const usdcContract = await getContract({ name: "USDC", provider });
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);

    if (valueAsUsdc.lt(utils.parseUnits("0.01", USDC_DECIMALS))) {
      return "Must deposit more than $0.01";
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    if (valueAsUsdc.gt(userUsdcBalance)) {
      return "Amount exceeds USDC balance";
    }
  };

  const [availableBalance, setAvailableBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!account || !provider) {
      return;
    }
    getContract({ name: "USDC", provider })
      .then((usdcContract) => usdcContract.balanceOf(account))
      .then((balance) =>
        setAvailableBalance(
          formatCrypto(
            { token: "USDC", amount: balance },
            { includeToken: true }
          )
        )
      );
  }, [account, provider]);

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div>
        <DollarInput
          control={control}
          name="supply"
          label="Investment amount"
          colorScheme="light"
          textSize="xl"
          labelClassName="!text-sm !mb-3"
          labelDecoration={
            <span className="text-xs">Balance: {availableBalance}</span>
          }
          className="mb-4"
          maxValue={async () => {
            if (!account || !provider) {
              throw new Error(
                "Wallet not connected when trying to compute max"
              );
            }
            const usdcContract = await getContract({
              name: "USDC",
              provider,
            });
            const userUsdcBalance = await usdcContract.balanceOf(account);
            return userUsdcBalance;
          }}
          rules={{ required: "Required", validate: validateMaximumAmount }}
        />
        <Checkbox
          {...register("isStaking")}
          label={`Stake to earn GFI (${formatPercent(
            seniorPoolApyFromGfiFiat
          )})`}
          labelDecoration={
            <InfoIconTooltip content="Liquidity Providers can earn GFI by staking the FIDU they receive from supplying USDC to the Senior Pool. Selecting this box will automatically stake the FIDU you receive for this supply transaction. GFI tokens are granted at a variable est. APY rate, which is based on a target pool balance set by Governance." />
          }
          colorScheme="light"
          className="mb-3"
        />
        <div className="mb-4 text-xs">
          By clicking &ldquo;Invest&rdquo; below, I hereby agree to the{" "}
          <Link href="/senior-pool-agreement-interstitial">
            Senior Pool Agreement
          </Link>
          . Please note the protocol deducts a 0.50% fee upon withdrawal for
          protocol reserves.
        </div>
      </div>
      <Button
        className="block w-full"
        size="xl"
        colorScheme="mustard"
        type="submit"
      >
        Invest
      </Button>
    </Form>
  );
}