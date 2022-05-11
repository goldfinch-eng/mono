import { useApolloClient, gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber, utils } from "ethers";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { IMaskInput } from "react-imask";
import { toast } from "react-toastify";

import { InfoIconTooltip, Link } from "@/components/design-system";
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
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";
import { openWalletModal } from "@/lib/state/actions";
import { waitForSubgraphBlock } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

export const SUPPLY_PANEL_FIELDS = gql`
  fragment SupplyPanelFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    agreement @client
  }
`;
interface SupplyPanelProps {
  tranchedPool: SupplyPanelFieldsFragment;
  fiatPerGfi: number;
}

interface SupplyForm {
  supply: string;
}

export default function SupplyPanel({
  tranchedPool: {
    id: tranchedPoolAddress,
    estimatedJuniorApy,
    estimatedJuniorApyFromGfiRaw,
    agreement,
  },
  fiatPerGfi,
}: SupplyPanelProps) {
  const apolloClient = useApolloClient();

  const { account, provider, chainId } = useWallet();
  const [returnFromBaseApy, setReturnFromBaseApy] = useState(0);
  const [returnFromGfiApy, setReturnFromGfiApy] = useState(0);

  const { tranchedPoolContract } = useTranchedPoolContract(tranchedPoolAddress);
  const { usdcContract } = useUsdcContract();

  const { handleSubmit, control, watch } = useForm<SupplyForm>();

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
  useEffect(() => {
    if (supplyValue) {
      const s = parseFloat(supplyValue);
      setReturnFromBaseApy(s * estimatedJuniorApy.toUnsafeFloat());
      setReturnFromGfiApy(s * fiatApyFromGfi.toUnsafeFloat());
    } else {
      setReturnFromBaseApy(0);
      setReturnFromGfiApy(0);
    }
  }, [supplyValue, estimatedJuniorApy, fiatApyFromGfi]);

  return (
    <div className="rounded-xl bg-[#192852] bg-gradientRed p-5 text-white">
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
                    amount: returnFromBaseApy,
                  })}
                </span>
                <Image
                  src="/ui/logo-usdc.png"
                  alt="USDC Logo"
                  width={20}
                  height={20}
                />
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
                    amount: returnFromGfiApy,
                  })}
                </span>
                <Image
                  src="/ui/logo-gfi.png"
                  alt="GFI Logo"
                  width={20}
                  height={20}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-3 flex flex-row items-end justify-between">
        <span className="text-sm">Supply amount</span>
        {account && (
          <span className="text-xs opacity-60">
            {account.substring(0, 6)}...{account.substring(account.length - 4)}
            <span className=""></span>
          </span>
        )}
      </div>

      <div className="mb-6 rounded-lg bg-sky-900 p-1">
        {account ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="relative">
              <Controller
                control={control}
                name="supply"
                rules={{ required: "Required" }}
                render={({ field: { onChange, ref } }) => (
                  <IMaskInput
                    mask="$amount USDC"
                    blocks={{
                      amount: {
                        mask: Number,
                        thousandsSeparator: ",",
                        placeholderChar: "9",
                        lazy: false,
                        scale: 2,
                        radix: ".",
                      },
                    }}
                    radix="."
                    unmask={true}
                    lazy={false}
                    ref={ref}
                    onAccept={onChange}
                    className="w-full bg-transparent py-4 pl-4 pr-16 text-2xl focus:ring-0"
                  />
                )}
              />

              <div className="absolute right-4 top-1/2 -translate-y-1/2 transform rounded-md border border-sky-500 px-2 py-1 text-[10px] uppercase">
                Max
              </div>
            </div>
            <button
              className={clsx(
                "block w-full rounded-md bg-white py-5 font-medium text-sky-700 hover:bg-sand-200 disabled:pointer-events-none disabled:opacity-60"
              )}
              disabled={!supplyValue}
            >
              Supply
            </button>
          </form>
        ) : (
          <button
            className="block w-full rounded-md bg-white py-5 font-medium text-sky-700"
            onClick={openWalletModal}
          >
            Connect Wallet
          </button>
        )}
      </div>
      <div className="mt-3 text-xs">
        By entering my name and clicking “Supply” below, I hereby agree and
        acknowledge that (i) I am electronically signing and becoming a party to
        the{" "}
        {agreement ? (
          <Link href={agreement}>Loan Agreement</Link>
        ) : (
          "Loan Agreement"
        )}{" "}
        for this pool, and (ii) my name and transaction information may be
        shared with the borrower.
      </div>
    </div>
  );
}
