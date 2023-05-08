import { gql, useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Alert,
  AssetBox,
  Button,
  Checkbox,
  DollarInput,
  Form,
  InfoIconTooltip,
  Link,
  confirmDialog,
} from "@/components/design-system";
import { dataLayerPushEvent } from "@/lib/analytics";
import { generateErc20PermitSignature, getContract } from "@/lib/contracts";
import {
  formatCrypto,
  formatPercent,
  stringToCryptoAmount,
} from "@/lib/format";
import { SeniorPoolSupplyPanelPoolFieldsFragment } from "@/lib/graphql/generated";
import { approveErc20IfRequired, computeApyFromGfiInFiat } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { isSmartContract, useWallet } from "@/lib/wallet";

export const SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS = gql`
  fragment SeniorPoolSupplyPanelPoolFields on SeniorPool {
    address
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
  const { account, provider, signer } = useWallet();
  const apolloClient = useApolloClient();

  const onSubmit = async (data: FormFields) => {
    if (!account || !signer) {
      return;
    }

    const supplyAmount = stringToCryptoAmount(data.supply, "USDC");

    const investmentAmountConfirmed = await confirmDialog(
      <>
        <AssetBox
          asset={{
            name: "Total Investment",
            description: "",
            usdcAmount: supplyAmount,
          }}
          omitWrapperStyle
        />
        <Alert className="my-6 text-justify" type="info" hasIcon={false}>
          <div className="mb-2 flex">
            <div className="text-md font-bold">Withdrawal Requests</div>
          </div>
          <p className="my-2">
            Based on the withdrawal queue (~$42,000,000) and the projected
            repayments by borrowers, you may not be able to withdraw your assets
            for an extended period of time. Currently, the estimated average
            withdrawal time for ${formatCrypto(supplyAmount)} is 24 months.
          </p>
          <p>
            Senior Pool liquidity constantly changes, so the actual time to
            withdraw your assets may be shorter or longer depending on a variety
            of factors.
          </p>
        </Alert>
        <p className="mb-6 text-justify text-xs text-sand-400">
          By clicking “Confirm” below, I hereby agree and acknowledge that I am
          investing capital in an asset that may not be available to withdraw.
        </p>
      </>,
      "Confirm Investment"
    );

    if (!investmentAmountConfirmed) {
      return;
    }

    const chainId = await signer.getChainId();
    const usdcContract = await getContract({ name: "USDC", signer });

    let submittedTransaction;

    // Smart contract wallets cannot sign a message and therefore can't use depositWithPermit
    if (await isSmartContract(account, provider)) {
      if (data.isStaking) {
        const stakingRewardsContract = await getContract({
          name: "StakingRewards",
          signer,
        });
        await approveErc20IfRequired({
          account,
          spender: stakingRewardsContract.address,
          amount: supplyAmount.amount,
          erc20Contract: usdcContract,
        });
        submittedTransaction = await toastTransaction({
          transaction: stakingRewardsContract.depositAndStake(
            supplyAmount.amount
          ),
          pendingPrompt: "Deposit and stake to senior pool submitted.",
        });
      } else {
        const seniorPoolContract = await getContract({
          name: "SeniorPool",
          signer,
        });
        await approveErc20IfRequired({
          account,
          spender: seniorPoolContract.address,
          amount: supplyAmount.amount,
          erc20Contract: usdcContract,
        });
        submittedTransaction = await toastTransaction({
          transaction: seniorPoolContract.deposit(supplyAmount.amount),
          pendingPrompt: "Deposit into senior pool submitted",
        });
      }
    } else {
      const now = (await provider.getBlock("latest")).timestamp;
      const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now

      if (data.isStaking) {
        const stakingRewardsContract = await getContract({
          name: "StakingRewards",
          signer,
        });
        const signature = await generateErc20PermitSignature({
          erc20TokenContract: usdcContract,
          chainId,
          owner: account,
          spender: stakingRewardsContract.address,
          value: supplyAmount.amount,
          deadline,
        });
        const transaction = stakingRewardsContract.depositWithPermitAndStake(
          supplyAmount.amount,
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
          signer,
        });
        const signature = await generateErc20PermitSignature({
          erc20TokenContract: usdcContract,
          chainId,
          owner: account,
          spender: seniorPoolContract.address,
          value: supplyAmount.amount,
          deadline,
        });
        const transaction = seniorPoolContract.depositWithPermit(
          supplyAmount.amount,
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
      ecommerce: {
        currency: "USD",
        transaction_id: submittedTransaction.transactionHash,
        value: parseFloat(data.supply),
        items: [{ item_id: seniorPool.address, item_name: "Senior Pool" }],
      },
    });

    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "seniorPoolStakedPositions" });
      },
    });
  };

  const validateMaximumAmount = async (value: string) => {
    if (!account) {
      return;
    }
    const usdcContract = await getContract({ name: "USDC" });
    const valueAsUsdc = stringToCryptoAmount(value, "USDC");

    if (valueAsUsdc.amount.lt(stringToCryptoAmount("0.01", "USDC").amount)) {
      return "Must deposit more than $0.01";
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    if (valueAsUsdc.amount.gt(userUsdcBalance)) {
      return "Amount exceeds USDC balance";
    }
  };

  const [availableBalance, setAvailableBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!account) {
      return;
    }
    getContract({ name: "USDC" })
      .then((usdcContract) => usdcContract.balanceOf(account))
      .then((balance) =>
        setAvailableBalance(
          formatCrypto(
            { token: "USDC", amount: balance },
            { includeToken: true }
          )
        )
      );
  }, [account]);

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
            if (!account) {
              throw new Error(
                "Wallet not connected when trying to compute max"
              );
            }
            const usdcContract = await getContract({ name: "USDC" });
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
