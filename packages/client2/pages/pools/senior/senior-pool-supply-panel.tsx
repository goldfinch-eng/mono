import { gql, useApolloClient } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Form,
  Icon,
  InfoIconTooltip,
  Link,
} from "@/components/design-system";
import { USDC_DECIMALS } from "@/constants";
import { generateErc20PermitSignature, useContract } from "@/lib/contracts";
import { formatCrypto, formatFiat, formatPercent } from "@/lib/format";
import {
  SeniorPoolSupplyPanelPoolFieldsFragment,
  SeniorPoolSupplyPanelUserFieldsFragment,
  SupportedCrypto,
  SupportedFiat,
  UidType,
} from "@/lib/graphql/generated";
import {
  approveErc20IfRequired,
  canUserParticipateInPool,
  computeApyFromGfiInFiat,
} from "@/lib/pools";
import { openVerificationModal, openWalletModal } from "@/lib/state/actions";
import { toastTransaction } from "@/lib/toast";
import { isSmartContract, useWallet } from "@/lib/wallet";

export const SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS = gql`
  fragment SeniorPoolSupplyPanelPoolFields on SeniorPool {
    latestPoolStatus {
      id
      estimatedApy
      estimatedApyFromGfiRaw
    }
  }
`;

export const SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS = gql`
  fragment SeniorPoolSupplyPanelUserFields on User {
    id
    isUsEntity
    isNonUsEntity
    isUsAccreditedIndividual
    isUsNonAccreditedIndividual
    isNonUsIndividual
    isGoListed
  }
`;

interface SeniorPoolSupplyPanelProps {
  seniorPool: SeniorPoolSupplyPanelPoolFieldsFragment;
  user: SeniorPoolSupplyPanelUserFieldsFragment | null;
  fiatPerGfi: number;
}

interface FormFields {
  supply: string;
  isStaking: boolean;
}

export function SeniorPoolSupplyPanel({
  seniorPool,
  user,
  fiatPerGfi,
}: SeniorPoolSupplyPanelProps) {
  const seniorPoolApyUsdc = seniorPool.latestPoolStatus.estimatedApy;
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
    fiatPerGfi
  );

  const rhfMethods = useForm<FormFields>({
    defaultValues: { isStaking: true },
  });
  const { control, register, watch, setValue } = rhfMethods;
  const supplyValue = watch("supply");
  const { account, provider } = useWallet();
  const seniorPoolContract = useContract("SeniorPool");
  const stakingRewardsContract = useContract("StakingRewards");
  const usdcContract = useContract("USDC");
  const apolloClient = useApolloClient();

  const onSubmit = async (data: FormFields) => {
    if (
      !account ||
      !provider ||
      !usdcContract ||
      !stakingRewardsContract ||
      !seniorPoolContract
    ) {
      return;
    }
    const value = utils.parseUnits(data.supply, USDC_DECIMALS);

    // Smart contract wallets cannot sign a message and therefore can't use depositWithPermit
    if (await isSmartContract(account, provider)) {
      if (data.isStaking) {
        await approveErc20IfRequired({
          account,
          spender: stakingRewardsContract.address,
          amount: value,
          erc20Contract: usdcContract,
        });
        await toastTransaction({
          transaction: stakingRewardsContract.depositAndStake(value),
          pendingPrompt: "Deposit and stake to senior pool submitted.",
        });
      } else {
        await approveErc20IfRequired({
          account,
          spender: seniorPoolContract.address,
          amount: value,
          erc20Contract: usdcContract,
        });
        await toastTransaction({
          transaction: seniorPoolContract.deposit(value),
          pendingPrompt: "Deposit into senior pool submitted",
        });
      }
    } else {
      const now = (await provider.getBlock("latest")).timestamp;
      const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now

      if (data.isStaking) {
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
        await toastTransaction({
          transaction,
          pendingPrompt: `Deposit and stake submitted for senior pool.`,
        });
      } else {
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
        await toastTransaction({
          transaction,
          pendingPrompt: `Deposit submitted for senior pool.`,
        });
      }
    }

    await apolloClient.refetchQueries({ include: "active" });
  };

  const isUserVerified =
    user?.isGoListed ||
    user?.isUsEntity ||
    user?.isNonUsEntity ||
    user?.isUsAccreditedIndividual ||
    user?.isUsNonAccreditedIndividual ||
    user?.isNonUsIndividual;
  const canUserParticipate = !user
    ? false
    : canUserParticipateInPool(
        [
          UidType.NonUsEntity,
          UidType.NonUsIndividual,
          UidType.UsEntity,
          UidType.UsAccreditedIndividual,
        ],
        user
      );

  const handleMax = async () => {
    if (!account || !usdcContract) {
      return;
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    setValue("supply", utils.formatUnits(userUsdcBalance, USDC_DECIMALS));
  };

  const validateMaximumAmount = async (value: string) => {
    if (!account || !usdcContract) {
      return;
    }
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);

    if (valueAsUsdc.lte(BigNumber.from(0))) {
      return "Must deposit more than 0";
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    if (valueAsUsdc.gt(userUsdcBalance)) {
      return "Amount exceeds USDC balance";
    }
  };

  const [availableBalance, setAvailableBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!account || !usdcContract) {
      return;
    }
    usdcContract
      .balanceOf(account)
      .then((balance) =>
        setAvailableBalance(
          formatCrypto(
            { token: SupportedCrypto.Usdc, amount: balance },
            { includeToken: true }
          )
        )
      );
  }, [account, usdcContract]);

  return (
    <div className="rounded-xl bg-sunrise-02 p-5 text-white">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm">Total est. APY</span>
        <InfoIconTooltip content="The Senior Pool's total current estimated APY, including the current USDC APY and est. GFI rewards APY." />
      </div>
      <div className="mb-8 text-6xl">
        {formatPercent(seniorPoolApyUsdc.addUnsafe(seniorPoolApyFromGfiFiat))}
      </div>
      <table className="mb-8 w-full text-left">
        <thead>
          <tr>
            <th scope="col" className="w-1/2 pb-3 font-normal">
              Est. APY breakdown
            </th>
            <th scope="col" className="w-1/2 pb-3 font-normal">
              <div className="flex items-center justify-end gap-2">
                <span>Est. return</span>
                <InfoIconTooltip content="The current estimated annual return on investment in the Senior Pool, based on the supply amount entered below. The USDC returns, sourced from Borrowers' repayments to their Pools, are based on the Senior Pool's current usage and balance. The GFI returns are based on the Pool's estimated GFI Investor Rewards." />
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="text-xl">
          <tr>
            <td className="border border-[#674C69] p-3">
              {formatPercent(seniorPoolApyUsdc)} APY
            </td>
            <td className="border border-[#674C69] p-3">
              <div className="flex items-center justify-end gap-2">
                <span>
                  {supplyValue
                    ? formatFiat({
                        symbol: SupportedFiat.Usd,
                        amount:
                          parseFloat(supplyValue) *
                          seniorPoolApyUsdc.toUnsafeFloat(),
                      })
                    : "USDC"}
                </span>
                <Icon name="Usdc" aria-label="USDC logo" size="md" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3">
              {formatPercent(seniorPoolApyFromGfiFiat)} APY
            </td>
            <td className="border border-[#674C69] p-3">
              <div className="flex items-center justify-end gap-2">
                <span>
                  {supplyValue
                    ? formatFiat({
                        symbol: SupportedFiat.Usd,
                        amount:
                          parseFloat(supplyValue) *
                          seniorPoolApyFromGfiFiat.toUnsafeFloat(),
                      })
                    : "GFI"}
                </span>
                <Icon name="Gfi" aria-label="GFI logo" size="md" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {!account ? (
        <Button
          className="block w-full"
          onClick={openWalletModal}
          size="xl"
          colorScheme="secondary"
        >
          Connect wallet
        </Button>
      ) : !isUserVerified ? (
        <Button
          className="block w-full"
          onClick={openVerificationModal}
          size="xl"
          colorScheme="secondary"
        >
          Verify my identity
        </Button>
      ) : !canUserParticipate ? (
        <div>
          <Button
            disabled
            className="block w-full"
            size="xl"
            colorScheme="secondary"
          >
            Supply
          </Button>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white">
            <Icon size="md" name="Exclamation" />
            <div>
              Sorry, you are not eligible to participate in the senior pool
              because you do not have a suitable UID.
            </div>
          </div>
        </div>
      ) : (
        <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
          <div>
            <DollarInput
              control={control}
              name="supply"
              label="Supply amount"
              colorScheme="dark"
              textSize="xl"
              labelClassName="!text-sm !mb-3"
              labelDecoration={
                <span className="text-xs">Balance: {availableBalance}</span>
              }
              className="mb-4"
              onMaxClick={handleMax}
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
              colorScheme="dark"
              className="mb-3"
            />
            {/* TODO senior pool agreement page */}
            <div className="mb-4 text-xs">
              By clicking “Supply” below, I hereby agree to the{" "}
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
            colorScheme="secondary"
            type="submit"
          >
            Supply
          </Button>
        </Form>
      )}
    </div>
  );
}
