import { useApolloClient, gql, useReactiveVar } from "@apollo/client";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import {
  Button,
  DollarInput,
  Icon,
  InfoIconTooltip,
  Input,
  Link,
  Tooltip,
} from "@/components/design-system";
import { TRANCHES, USDC_DECIMALS } from "@/constants";
import {
  useTranchedPoolContract,
  useUsdcContract,
  generateErc20PermitSignature,
} from "@/lib/contracts";
import { formatPercent, formatFiat } from "@/lib/format";
import {
  SupportedFiat,
  SupplyPanelFieldsFragment,
  useGetUidBalancesQuery,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";
import {
  openWalletModal,
  openKYCModal,
  openUIDModal,
} from "@/lib/state/actions";
import { isKYCDoneVar } from "@/lib/state/vars";
import { getKYCStatus } from "@/lib/user";
import { waitForSubgraphBlock } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_FIELDS = gql`
  fragment SupplyPanelFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    agreement @client
    remainingCapacity
    estimatedLeverageRatio
  }
`;

gql`
  query GetUidBalances {
    viewer @client {
      uidBalances {
        NonUSIndividual
        USAccreditedIndividual
        USNonAccreditedIndividual
        USEntity
        NonUSEntity
      }
    }
  }
`;

interface SupplyPanelProps {
  tranchedPool: SupplyPanelFieldsFragment;
  fiatPerGfi: number;
}

interface SupplyForm {
  supply: string;
  backerName: string;
}

export default function SupplyPanel({
  tranchedPool: {
    id: tranchedPoolAddress,
    estimatedJuniorApy,
    estimatedJuniorApyFromGfiRaw,
    agreement,
    remainingCapacity,
    estimatedLeverageRatio,
  },
  fiatPerGfi,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();
  const { account, provider, chainId } = useWallet();
  const { tranchedPoolContract } = useTranchedPoolContract(tranchedPoolAddress);
  const { usdcContract } = useUsdcContract();

  const isKYCDone = useReactiveVar(isKYCDoneVar);
  const { data: uidQueryData } = useGetUidBalancesQuery();
  const [uidCreated, setUIDCreated] = useState<boolean>(false);

  useEffect(() => {
    const isUIDCreated =
      uidQueryData?.viewer?.uidBalances?.NonUSEntity ||
      uidQueryData?.viewer?.uidBalances?.NonUSIndividual ||
      uidQueryData?.viewer?.uidBalances?.USAccreditedIndividual ||
      uidQueryData?.viewer?.uidBalances?.USEntity ||
      uidQueryData?.viewer?.uidBalances?.USNonAccreditedIndividual;

    setUIDCreated(!!isUIDCreated);
  }, [uidQueryData]);

  const {
    handleSubmit,
    control,
    watch,
    register,
    formState: { isSubmitting, errors },
    setValue,
  } = useForm<SupplyForm>();

  const remainingJuniorCapacity = remainingCapacity.div(
    estimatedLeverageRatio.add(1)
  );

  // TODO this should consider the amount of junior capacity remaining in the pool
  const handleMax = async () => {
    if (!account || !usdcContract) {
      return;
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    const maxAvailable = userUsdcBalance.lt(remainingJuniorCapacity)
      ? userUsdcBalance
      : remainingJuniorCapacity;
    setValue("supply", utils.formatUnits(maxAvailable, USDC_DECIMALS));
  };

  // TODO this should also consider the amoutn of junior capacity remaining in the pool
  const validateMaximumAmount = async (value: string) => {
    if (!account || !usdcContract) {
      return;
    }
    const valueAsUsdc = utils.parseUnits(value, USDC_DECIMALS);
    if (valueAsUsdc.gt(remainingJuniorCapacity)) {
      return "Amount exceeds remaining junior capacity";
    }
    if (valueAsUsdc.lte(BigNumber.from(0))) {
      return "Must deposit more than 0";
    }
    const userUsdcBalance = await usdcContract.balanceOf(account);
    if (valueAsUsdc.gt(userUsdcBalance)) {
      return "Amount exceeds USDC balance";
    }
  };

  const onSubmit = async (data: SupplyForm) => {
    if (
      !usdcContract ||
      !tranchedPoolContract ||
      !provider ||
      !account ||
      !chainId
    ) {
      throw new Error("Wallet not connected properly");
    }

    const value = utils.parseUnits(data.supply, USDC_DECIMALS);
    const now = (await provider.getBlock("latest")).timestamp;
    const deadline = BigNumber.from(now + 3600); // deadline is 1 hour from now

    const signature = await generateErc20PermitSignature({
      erc20TokenContract: usdcContract,
      provider,
      owner: account,
      spender: tranchedPoolAddress,
      value,
      deadline,
    });

    const transaction = await tranchedPoolContract.depositWithPermit(
      TRANCHES.Junior,
      value,
      deadline,
      signature.v,
      signature.r,
      signature.s
    );
    const toastId = toast(
      <div>
        Deposit submitted for pool {tranchedPoolAddress}, view it on{" "}
        <Link href={`https://etherscan.io/tx/${transaction.hash}`}>
          etherscan.io
        </Link>
      </div>,
      { autoClose: false }
    );
    const receipt = await transaction.wait();
    await waitForSubgraphBlock(receipt.blockNumber);
    await apolloClient.refetchQueries({ include: "active" });
    toast.update(toastId, {
      render: `Deposit into pool ${tranchedPoolAddress} succeeded`,
      type: "success",
      autoClose: 5000,
    });
  };

  const supplyValue = watch("supply");
  const fiatApyFromGfi = computeApyFromGfiInFiat(
    estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );

  return (
    <div className="rounded-xl bg-sunrise-02 p-5 text-white">
      <div className="mb-3 flex flex-row justify-between">
        <span className="text-sm">Est APY</span>
        <span className="opacity-60">
          <InfoIconTooltip
            size="sm"
            content={
              <div className="max-w-xs">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                Officia culpa possimus accusantium cumque suscipit.
              </div>
            }
          />
        </span>
      </div>

      <div className="mb-8 text-6xl font-medium">
        {formatPercent(estimatedJuniorApy.addUnsafe(fiatApyFromGfi))}
      </div>

      <table className="mb-8 w-full">
        <thead>
          <tr>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              Est APY breakdown
            </th>
            <th className="w-1/2 pb-3 text-left text-sm font-normal">
              <div className="flex items-center justify-between">
                <span>Est return</span>
                <span className="opacity-60">
                  <InfoIconTooltip
                    size="sm"
                    content={
                      <div className="max-w-xs">
                        Lorem ipsum dolor sit amet, consectetur adipisicing
                        elit. Officia culpa possimus accusantium cumque
                        suscipit.
                      </div>
                    }
                  />
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(estimatedJuniorApy)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {formatFiat({
                    symbol: SupportedFiat.Usd,
                    amount: supplyValue
                      ? parseFloat(supplyValue) *
                        estimatedJuniorApy.toUnsafeFloat()
                      : 0,
                  })}
                </span>
                <Icon name="Usdc" aria-label="USDC logo" size="md" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#674C69] p-3 text-xl">
              {formatPercent(fiatApyFromGfi)} APY
            </td>
            <td className="border border-[#674C69] p-3 text-right text-xl">
              <div className="flex w-full items-center justify-end">
                <span className="mr-2">
                  {formatFiat({
                    symbol: SupportedFiat.Usd,
                    amount: supplyValue
                      ? parseFloat(supplyValue) * fiatApyFromGfi.toUnsafeFloat()
                      : 0,
                  })}
                </span>
                <Tooltip
                  content="This return is estimated based on the current value of GFI in US dollars."
                  placement="top"
                  useWrapper
                >
                  <Icon name="Gfi" aria-label="GFI logo" size="md" />
                </Tooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {account && !isKYCDone && !uidCreated && (
        <button
          className="block w-full rounded-md bg-white py-5 font-medium text-sky-700"
          onClick={() => {
            openKYCModal();
          }}
        >
          Verify Identity
        </button>
      )}

      {account && isKYCDone && !uidCreated && (
        <button
          className="block w-full rounded-md bg-white py-5 font-medium text-sky-700"
          onClick={async () => {
            try {
              // Prefetch KYC status
              await getKYCStatus(account);

              openUIDModal();
            } catch {
              throw new Error("Could not get KYC status.");
            }
          }}
        >
          Claim my UID
        </button>
      )}

      {account && isKYCDone && uidCreated && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <DollarInput
              control={control}
              name="supply"
              label="Supply amount"
              labelDecoration={
                <span className="text-xs opacity-60">
                  {account.substring(0, 6)}...
                  {account.substring(account.length - 4)}
                </span>
              }
              rules={{ required: "Required", validate: validateMaximumAmount }}
              colorScheme="dark"
              textSize="xl"
              onMaxClick={handleMax}
              labelClassName="!text-sm !mb-3"
              errorMessage={errors?.supply?.message}
            />
          </div>
          <div className={!supplyValue ? "hidden" : undefined}>
            <div className="mb-3">
              <Input
                {...register("backerName", { required: "Required" })}
                label="Full legal name"
                labelDecoration={
                  <InfoIconTooltip
                    size="sm"
                    placement="top"
                    content="Lorem ipsum. Your full name is required for reasons"
                  />
                }
                placeholder="First and last name"
                colorScheme="dark"
                textSize="xl"
                labelClassName="!text-sm !mb-3"
                errorMessage={errors?.backerName?.message}
              />
            </div>
            <div className="mb-3 text-xs">
              By entering my name and clicking “Supply” below, I hereby agree
              and acknowledge that (i) I am electronically signing and becoming
              a party to the{" "}
              {agreement ? (
                <Link href={agreement}>Loan Agreement</Link>
              ) : (
                "Loan Agreement"
              )}{" "}
              for this pool, and (ii) my name and transaction information may be
              shared with the borrower.
            </div>
          </div>
          <Button
            className="block w-full"
            disabled={Object.keys(errors).length !== 0}
            size="xl"
            colorScheme="secondary"
            type="submit"
            isLoading={isSubmitting}
          >
            Supply
          </Button>
        </form>
      )}

      {!account && (
        <Button
          className="block w-full"
          onClick={openWalletModal}
          size="xl"
          colorScheme="secondary"
        >
          Connect Wallet
        </Button>
      )}
    </div>
  );
}
